package com.interviewos.api.interview

import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.TransactionStatus
import org.springframework.transaction.support.SimpleTransactionStatus

/**
 * A [PlatformTransactionManager] test double that actually tracks whether a transaction is
 * open, unlike the bare Mockito mock [BankRoundHarness] otherwise uses — that mock answers
 * `getTransaction` but has no notion of "open", so it cannot tell a test whether code ran
 * inside a transaction or outside one.
 *
 * `open` counts nested `getTransaction` calls without a matching `commit`/`rollback` yet.
 * `InterviewService.inTransaction` never actually nests (each `TransactionTemplate.execute`
 * opens and closes its own), so in every test using this, `open` is 0 outside any
 * transaction and 1 for the duration of one.
 */
class RecordingTransactionManager : PlatformTransactionManager {
    var open: Int = 0
        private set

    override fun getTransaction(definition: TransactionDefinition?): TransactionStatus {
        open += 1
        return SimpleTransactionStatus()
    }

    override fun commit(status: TransactionStatus) {
        open -= 1
    }

    override fun rollback(status: TransactionStatus) {
        open -= 1
    }
}
