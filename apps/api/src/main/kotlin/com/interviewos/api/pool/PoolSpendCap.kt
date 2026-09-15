package com.interviewos.api.pool

/**
 * What stops a generation run spending more than it was given.
 *
 * **Checked before the call, not after it.** A cap read after each call tells you how much
 * you have already overspent, which is a report rather than a limit — and the call that
 * breaks it is exactly the one nobody authorised. So the question this asks is "could the
 * next call take us past the cap", and it refuses while the answer might be yes.
 *
 * That needs a guess at what the next call will cost, because its real cost is only
 * knowable once it has returned. The guess is [headroomMicroUsd], and it is deliberately
 * generous — comfortably above a generation call served by the expensive model at the back
 * of the chain. Being generous means a run stops slightly early. Being tight means it
 * stops slightly late, which is the failure mode this class exists to prevent.
 *
 * [spent] reads the ledger rather than a counter kept in memory, because a resumed run has
 * no memory: the first thing a resume must not do is spend the whole cap again on top of
 * what the previous attempt already spent.
 */
class PoolSpendCap(
    private val capMicroUsd: Long,
    private val headroomMicroUsd: Long,
    private val spent: () -> Long,
) {
    data class Verdict(
        val mayCall: Boolean,
        val spentMicroUsd: Long,
        val remainingMicroUsd: Long,
    )

    /**
     * Synchronised, so two workers cannot both read the same "plenty left" and then both
     * spend it. With a small configured concurrency the contention is nothing, and the
     * alternative is a cap that holds only when the job runs single-threaded.
     */
    @Synchronized
    fun check(): Verdict {
        val alreadySpent = spent()
        val remaining = capMicroUsd - alreadySpent
        return Verdict(
            mayCall = remaining >= headroomMicroUsd,
            spentMicroUsd = alreadySpent,
            remainingMicroUsd = remaining,
        )
    }
}
