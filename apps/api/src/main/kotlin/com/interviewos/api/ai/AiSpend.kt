package com.interviewos.api.ai

import java.util.UUID

/**
 * One model call, and what it cost.
 *
 * @param call the method that was asked for — `assessAnswer`, `composeReport` — not the
 *   HTTP endpoint. Cost questions are always about a call site.
 * @param provider the provider that actually answered, which is not necessarily the one
 *   configured first.
 * @param fellBackFrom the provider that failed before this one succeeded, or null if the
 *   first choice served. **This is the field the whole ledger exists for.** The chain is
 *   ordered cheapest-first and reads as though it runs on the cheap model; when it does
 *   not, nothing anywhere said so and the bill went up 15x in silence.
 */
data class AiCallRecord(
    val call: String,
    val provider: String,
    val usage: AiUsage,
    val fellBackFrom: String?,
    val microUsd: Long,
    val userId: UUID?,
    val sessionId: UUID?,
)

/**
 * Which interview a model call belongs to.
 *
 * The AI interface deliberately knows nothing about sessions — it takes a brief and a
 * transcript, not a row id — and threading an id through every method to satisfy
 * bookkeeping would put accounting in the signature of every call. So the attribution
 * rides alongside on the thread instead.
 *
 * **It is explicit, not ambient.** Every site that knows which session it is working for
 * opts in with [of]; everywhere else records a call with no session attached, which is
 * honest. The one thing this must never do is attribute a call to the wrong interview,
 * so the value is always cleared on the way out — including down the exception path,
 * which is exactly when a round is failing over to the expensive model and the record
 * matters most.
 */
object AiSpendContext {
    private val current = ThreadLocal<Attribution?>()

    data class Attribution(
        val userId: UUID?,
        val sessionId: UUID?,
    )

    /**
     * Runs [block] with its model calls attributed to [sessionId].
     *
     * Nests correctly: the previous value is restored rather than cleared, so a call made
     * inside another attributed block does not silently lose its owner.
     */
    fun <T> of(
        userId: UUID?,
        sessionId: UUID?,
        block: () -> T,
    ): T {
        val previous = current.get()
        current.set(Attribution(userId, sessionId))
        return try {
            block()
        } finally {
            if (previous == null) current.remove() else current.set(previous)
        }
    }

    fun current(): Attribution? = current.get()
}

/**
 * Where a spend record goes.
 *
 * An interface so the fallback chain can be built and tested without a database, and so
 * that recording can never be the reason a round fails — see the implementation's
 * contract in `AiSpendRepository`.
 */
fun interface AiSpendRecorder {
    fun record(record: AiCallRecord)

    companion object {
        /** Records nothing. Used where the chain is constructed without persistence. */
        val NONE = AiSpendRecorder { }
    }
}
