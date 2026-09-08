package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerVideo
import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Whether the camera is analysed inside the round, or only stored for later.
 *
 * It is only stored, and that is the settled product decision rather than an oversight:
 * the camera is on and recording from the first turn, but body-language analysis is a
 * later moat. `CLAUDE.md` puts it as "capture it now, analyse it later".
 *
 * Sending it to the model in the round turned out to be the most expensive thing in the
 * gap between a candidate's last word and the next question. Measured against the live
 * API, on the same 14-second answer:
 *
 * ```
 * audio only       3.49s    2,852 input tokens
 * audio + camera   7.23s   11,702 input tokens   (30 seconds of video)
 * ```
 *
 * Gemini samples video at about a frame a second and charges roughly 258 tokens a frame,
 * so a minute of camera is several times the size of the entire prompt. All of that was
 * being spent on one sentence of `deliveryObservation` — and the assessment prompt
 * already knows what to do without it: "If no video is attached, judge delivery from the
 * audio alone and say nothing about body language."
 *
 * Nothing about capture, consent or retention changes. The recording is uploaded and kept
 * exactly as before; it is only left out of the one call the candidate is sitting and
 * waiting through. Turning it back on is:
 *
 * ```yaml
 * interviewos:
 *   round-media:
 *     analyse-video-in-round: true
 * ```
 */
@ConfigurationProperties(prefix = "interviewos.round-media")
data class RoundMediaProperties(
    val analyseVideoInRound: Boolean = false,
) {
    /**
     * The recording as the in-round model call should see it, which is normally not at
     * all. Null here means the turn is assessed from the audio; it never means the
     * recording was lost, and it has no bearing on what is stored.
     */
    fun videoForRound(
        bytes: ByteArray?,
        contentType: String?,
    ): AnswerVideo? =
        bytes
            ?.takeIf { analyseVideoInRound }
            ?.let { AnswerVideo(it, contentType ?: DEFAULT_CONTENT_TYPE) }

    /**
     * Whether anything actually looked at the candidate, which is the only honest basis
     * for letting a report say how they came across.
     *
     * Consent alone is not that basis, and reading it as though it were is a bug this had
     * for exactly one commit: the camera stopped being sent to the model, and the report
     * carried on allowing presence claims for anyone who had ticked the box. Nothing had
     * seen them, so "maintained good eye contact" would have been invented — the same
     * failure as a fabricated quote, wearing different clothes.
     */
    fun presenceWasObserved(consentVideo: Boolean): Boolean = consentVideo && analyseVideoInRound

    private companion object {
        /** What every browser we support records to; only a fallback if the part arrived unlabelled. */
        const val DEFAULT_CONTENT_TYPE = "video/webm"
    }
}
