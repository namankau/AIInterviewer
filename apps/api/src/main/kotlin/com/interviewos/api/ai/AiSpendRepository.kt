package com.interviewos.api.ai

import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * Writes the spend ledger.
 *
 * **In its own transaction, and that is the whole design.** A model call is billed the
 * moment it returns, regardless of what happens to the turn that made it — and the turns
 * that go wrong are the expensive ones. An answer that fails to save, a round the
 * candidate abandons mid-question, an assessment that comes back unusable: every one of
 * those cost money, and if the ledger joined the caller's transaction it would roll back
 * with them and report the spend as zero. The bill would show the money and the ledger
 * would not, which is worse than having no ledger at all.
 *
 * So `REQUIRES_NEW`: the record commits on its own, and survives the failure of whatever
 * was being attempted around it.
 */
@Repository
class AiSpendRepository(
    private val jdbcClient: JdbcClient,
) : AiSpendRecorder {
    private val log = LoggerFactory.getLogger(javaClass)

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    override fun record(record: AiCallRecord) {
        jdbcClient
            .sql(
                """
                insert into public.ai_calls
                  (call, provider, model, fell_back_from, prompt_tokens, output_tokens,
                   thought_tokens, audio_tokens, cached_tokens, micro_usd, user_id, session_id,
                   pool_run_id)
                values
                  (:call, :provider, :model, :fellBackFrom, :promptTokens, :outputTokens,
                   :thoughtTokens, :audioTokens, :cachedTokens, :microUsd, :userId, :sessionId,
                   :poolRunId)
                """.trimIndent(),
            ).param("call", record.call)
            .param("provider", record.provider)
            .param("model", record.usage.model)
            .param("fellBackFrom", record.fellBackFrom)
            .param("promptTokens", record.usage.promptTokens)
            .param("outputTokens", record.usage.outputTokens)
            .param("thoughtTokens", record.usage.thoughtTokens)
            .param("audioTokens", record.usage.audioTokens)
            .param("cachedTokens", record.usage.cachedTokens)
            .param("microUsd", record.microUsd)
            .param("userId", record.userId)
            .param("sessionId", record.sessionId)
            .param("poolRunId", record.poolRunId)
            .update()

        // Loud on purpose, and only on the path that costs money unexpectedly. A round
        // running on the provider it was configured to run on says nothing; one that
        // quietly moved to the model behind it says so in terms somebody scanning a log
        // will notice, because the previous version of this was a bill with no trail.
        if (record.fellBackFrom != null) {
            log.warn(
                "{} fell back from {} to {} and cost {} USD (at least — the refused call may also have been billed)",
                record.call,
                record.fellBackFrom,
                record.provider,
                "%.4f".format(record.microUsd / 1_000_000.0),
            )
        }

        // A model nobody has priced is costed at the most expensive tier rather than at
        // zero, so an unrecognised model shows up as alarming instead of as free. Saying
        // so keeps the table honest about which figures are real.
        if (!AiPrices.isKnown(record.usage.model)) {
            log.warn(
                "No published price for '{}'; costed at the fallback rate. Add it to AiPrices.",
                record.usage.model,
            )
        }
    }
}
