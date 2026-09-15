package com.interviewos.api.pool

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * How the question pool's generation job is allowed to behave.
 *
 * Every default here is the cautious one. This job is the only thing in the product that
 * spends money without a candidate waiting on the other end — nobody notices it running,
 * which means nobody notices it running away.
 *
 * @param enabled whether a run may actually call a model. **False by default, and that is
 *   load-bearing**: with it false the admin endpoint still plans a run and writes its
 *   cells, so the shape of a run can be reviewed, but nothing is generated and nothing is
 *   billed. Turning it on is a deliberate act by the owner (CLAUDE.md rule 7).
 * @param requestsPerMinute a ceiling on model calls per minute across the whole job. Low
 *   enough to stay well inside a free-tier rate limit, because being rate-limited mid-run
 *   makes the chain fall through to the expensive model, which is the opposite of what a
 *   cost-saving job should do.
 * @param concurrency how many cells are worked at once. Two, not eight: the job has all
 *   night, and every extra thread is another call in flight when the spend cap is reached.
 * @param questionsPerCell how many questions to ask for per (company, round, role, level).
 * @param duplicateSimilarity cosine similarity at or above which two questions are the
 *   same question. 0.90 rather than 0.95: these are short texts in a narrow domain, where
 *   near-identical phrasings sit high, and the cost of dropping a real question is one
 *   fewer in a cell while the cost of keeping a duplicate is a candidate being asked the
 *   same thing twice in one round. Measured tuning needs a live embedding run (task 043).
 * @param defaultSpendCapMicroUsd the cap a run gets when the request does not name one.
 *   $2.00. A full first pass is expected to cost a few dollars, so this stops after a
 *   fraction of it and asks to be resumed.
 * @param callHeadroomMicroUsd what the cap check assumes the *next* call might cost, since
 *   its real cost is only knowable afterwards. The run pauses while at least this much
 *   budget is left, so the cap is a limit rather than a post-mortem. $0.02 is comfortably
 *   above a measured generation call on the lead model and still above one served by the
 *   expensive model behind it.
 * @param embeddingModel the model the deduplicator embeds with.
 * @param embeddingDimensions the width asked for, which **must** equal the width of
 *   `pool_questions.embedding`. 768 is a published Matryoshka truncation of
 *   `gemini-embedding-001`'s native 3072 and sits under pgvector's 2000-dimension index
 *   ceiling, so the column stays indexable.
 * @param maxAttemptsPerCell how many times a failing cell is retried across resumes before
 *   it is left failed. A cell that fails twice is failing for a reason, and a third call
 *   is money spent on the same error.
 */
@ConfigurationProperties(prefix = "interviewos.pool")
data class PoolProperties(
    val enabled: Boolean = false,
    val requestsPerMinute: Int = 20,
    val concurrency: Int = 2,
    val questionsPerCell: Int = 6,
    val duplicateSimilarity: Double = 0.90,
    val defaultSpendCapMicroUsd: Long = 2_000_000,
    val callHeadroomMicroUsd: Long = 20_000,
    val embeddingModel: String = "gemini-embedding-001",
    val embeddingDimensions: Int = 768,
    val maxAttemptsPerCell: Int = 2,
) {
    init {
        require(requestsPerMinute > 0) { "interviewos.pool.requests-per-minute must be positive." }
        require(concurrency > 0) { "interviewos.pool.concurrency must be positive." }
        require(questionsPerCell > 0) { "interviewos.pool.questions-per-cell must be positive." }
        require(duplicateSimilarity in 0.0..1.0) { "interviewos.pool.duplicate-similarity must be between 0 and 1." }
        require(embeddingDimensions > 0) { "interviewos.pool.embedding-dimensions must be positive." }
    }
}
