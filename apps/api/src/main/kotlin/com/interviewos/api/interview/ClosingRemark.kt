package com.interviewos.api.interview

/**
 * The last thing the interviewer says.
 *
 * A round used to end by the screen changing. The candidate finished an answer, and the
 * room replaced itself with a completion page — no goodbye, no indication that the thing
 * they had been talking to for forty minutes had finished rather than crashed. Every real
 * interview ends with somebody saying that it has, and what happens next.
 *
 * **Written here rather than asked of the model, deliberately.** Three reasons, and they
 * are the same three that templated the DSA round's opening:
 *
 * - Nobody should wait several seconds for a spinner to produce "thanks, that's all".
 * - The model's own `nextQuestionText` is null on `conclude` by design, so asking would
 *   mean a second call at the exact moment the round is over.
 * - This is the one line where an unlucky generation is least recoverable. A closing that
 *   praises a bad round, or promises something the report will not contain, undoes the
 *   whole calibration in one sentence.
 *
 * It says nothing about how the round went. That is the report's to say, on evidence,
 * and a warm sign-off is exactly how a candidate talks themselves into an expectation the
 * report then has to take away.
 */
object ClosingRemark {
    /**
     * @param ranOutOfTime true when the clock ended the round rather than the interviewer
     *   deciding it was done. Worth distinguishing: a candidate cut off mid-thought knows
     *   they were, and pretending otherwise reads as not having noticed.
     */
    fun forRound(ranOutOfTime: Boolean): String =
        if (ranOutOfTime) {
            "That's us out of time, so I'll stop you there. Thanks for talking it through with me — " +
                "give me a moment and your feedback will be ready."
        } else {
            "That's everything I wanted to cover. Thanks for talking it through with me — " +
                "give me a moment and your feedback will be ready."
        }
}
