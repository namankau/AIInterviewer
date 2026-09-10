package com.interviewos.api.ai

/**
 * What a model call costs, so that "why is an interview expensive" is a query rather
 * than an argument.
 *
 * This exists because the answer turned out to be unguessable from the code. The chain
 * is configured cheapest-first and reads as though it runs on the cheap model; the
 * recorded reports said otherwise, and the gap between the two is the entire cost
 * problem. Measured on the same report call, same prompt, three runs each:
 *
 * | model                 | prompt | output | thinking | cost      |
 * |-----------------------|--------|--------|----------|-----------|
 * | gemini-2.5-flash-lite | 2116   | ~1900  | 0        | ~$0.0010  |
 * | gemini-3.5-flash      | 2116   | ~1600  | ~1600    | ~$0.0350  |
 *
 * Thirty-five times, for a result neither of us could tell apart. A fall-through nobody
 * can see is therefore not a resilience feature, it is an unbounded bill.
 *
 * **Prices are USD per million tokens**, from ai.google.dev/gemini-api/docs/pricing as
 * published on 2026-09-10. They go stale, and the models themselves do: `gemini-2.5-flash-lite`
 * and `gemini-2.5-flash` were both retired within a day of this table being written, which is
 * exactly how the chain ended up serving every call from the expensive model again. A model absent from this table is costed at
 * [UNKNOWN] rather than at zero — a call this does not recognise must never look free,
 * because "free" is exactly how the expensive model stayed invisible.
 */
object AiPrices {
    /**
     * @param text input tokens: text, image, video, and PDF pages
     * @param audio input tokens carrying audio, billed at a higher rate than text
     * @param output everything the model emits, **including tokens it spent thinking**
     * @param cached input served from a context cache, where the provider reports it
     */
    data class Price(
        val text: Double,
        val audio: Double,
        val output: Double,
        val cached: Double,
    )

    /** Applied to any model not in [PRICES]. Deliberately not zero. */
    val UNKNOWN = Price(text = 1.50, audio = 1.50, output = 9.00, cached = 0.15)

    private val PRICES =
        mapOf(
            // Live, and the one the chain leads with.
            "gemini-3.5-flash-lite" to Price(text = 0.30, audio = 0.30, output = 2.50, cached = 0.03),
            "gemini-3.1-flash-lite" to Price(text = 0.25, audio = 0.50, output = 1.50, cached = 0.025),
            "gemini-3.5-flash" to Price(text = 1.50, audio = 1.50, output = 9.00, cached = 0.15),
            // Retired by Google on or before 2026-09-10 and kept here on purpose: rows in
            // `ai_calls` still name them, and a historical cost that silently changed to
            // the UNKNOWN rate would rewrite what past rounds actually cost.
            "gemini-2.5-flash-lite" to Price(text = 0.10, audio = 0.30, output = 0.40, cached = 0.01),
            "gemini-2.5-flash" to Price(text = 0.30, audio = 1.00, output = 2.50, cached = 0.03),
            // Speech is priced per token of *audio produced*, at 25 tokens per second of
            // sound. That is the whole reason a long question costs real money: the bill
            // scales with how long the interviewer talks, not with how hard the question was.
            "gemini-2.5-flash-preview-tts" to Price(text = 0.50, audio = 10.00, output = 10.00, cached = 0.50),
            "gemini-3.1-flash-tts-preview" to Price(text = 1.00, audio = 20.00, output = 20.00, cached = 1.00),
        )

    fun of(model: String): Price = PRICES[model] ?: UNKNOWN

    /** Whether [model] has a published price here, or is being costed at [UNKNOWN]. */
    fun isKnown(model: String): Boolean = model in PRICES

    /**
     * [usage] in millionths of a US dollar.
     *
     * Integer micro-dollars rather than a `Double`, because this is summed over thousands
     * of rows and floating-point drift in a cost total is the kind of bug that is only
     * ever noticed once the number is being used to set a price.
     */
    fun microUsd(usage: AiUsage): Long {
        val price = of(usage.model)
        val weighted =
            usage.textTokens * price.text +
                usage.audioTokens * price.audio +
                usage.billedOutputTokens * price.output +
                usage.cachedTokens * price.cached
        // Prices are per million tokens and the answer is in millionths of a dollar, so
        // the two conversions cancel: `weighted` is already the figure wanted.
        return Math.round(weighted)
    }
}
