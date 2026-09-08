package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * What the candidate waits for, and what they do not.
 *
 * The camera roughly doubled the in-round model call — 3.49s to 7.23s on the same answer,
 * 2,852 input tokens against 11,702 — because Gemini samples video at about a frame a
 * second. It bought one sentence about body language, which is not in the report yet.
 *
 * The distinction these tests protect is that leaving it out of the *call* is not leaving
 * it out of the *recording*. Consent, upload and retention are untouched; a future round
 * of body-language work reads the stored file.
 */
class RoundMediaPropertiesTest {
    @Test
    fun `the camera does not go to the model by default`() {
        val chosen = RoundMediaProperties().videoForRound(byteArrayOf(1, 2, 3), "video/webm")

        assertNull(chosen, "the default has to be off, or the property is decoration")
    }

    @Test
    fun `it does go when the round is configured to analyse it`() {
        val chosen =
            RoundMediaProperties(analyseVideoInRound = true)
                .videoForRound(byteArrayOf(1, 2, 3), "video/mp4")

        assertEquals("video/mp4", chosen?.contentType)
        assertEquals(3, chosen?.bytes?.size)
    }

    /**
     * A candidate who declined the camera, or a browser that recorded none, is not a
     * different case from one whose video we chose not to send: both are assessed from
     * the audio.
     */
    @Test
    fun `no recording is null whatever the setting says`() {
        assertNull(RoundMediaProperties(analyseVideoInRound = true).videoForRound(null, "video/webm"))
        assertNull(RoundMediaProperties().videoForRound(null, null))
    }

    @Test
    fun `an unlabelled part still gets a usable content type`() {
        val chosen = RoundMediaProperties(analyseVideoInRound = true).videoForRound(byteArrayOf(9), null)

        assertEquals("video/webm", chosen?.contentType)
    }
}
