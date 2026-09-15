package com.interviewos.api.pool

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.concurrent.atomic.AtomicLong

class PoolSpendCapTest {
    @Test
    fun `a run with the whole budget left may call`() {
        val cap = PoolSpendCap(capMicroUsd = 1_000_000, headroomMicroUsd = 20_000) { 0 }

        assertThat(cap.check().mayCall).isTrue()
    }

    @Test
    fun `it refuses while there is still budget left, not after it is gone`() {
        // 985,000 of 1,000,000 spent. There is money left, and a cap that only refused once
        // the balance went negative would authorise one more call with 15,000 of headroom
        // for a call that costs 20,000 — which is how a cap becomes a report.
        val cap = PoolSpendCap(capMicroUsd = 1_000_000, headroomMicroUsd = 20_000) { 985_000 }

        val verdict = cap.check()

        assertThat(verdict.mayCall).isFalse()
        assertThat(verdict.remainingMicroUsd).isEqualTo(15_000)
    }

    @Test
    fun `exactly enough headroom is enough`() {
        val cap = PoolSpendCap(capMicroUsd = 1_000_000, headroomMicroUsd = 20_000) { 980_000 }

        assertThat(cap.check().mayCall).isTrue()
    }

    @Test
    fun `a cap of nothing authorises nothing`() {
        val cap = PoolSpendCap(capMicroUsd = 0, headroomMicroUsd = 20_000) { 0 }

        assertThat(cap.check().mayCall).isFalse()
    }

    @Test
    fun `it reads the ledger every time rather than remembering`() {
        // A resumed run has no memory of what the previous attempt spent, so the cap has to
        // go back to the ledger on every check. Counting in the job instead would let a
        // resume spend the whole cap again on top of what was already gone.
        val spent = AtomicLong(0)
        val cap = PoolSpendCap(capMicroUsd = 100_000, headroomMicroUsd = 20_000) { spent.get() }

        assertThat(cap.check().mayCall).isTrue()
        spent.set(90_000)
        assertThat(cap.check().mayCall).isFalse()
    }
}
