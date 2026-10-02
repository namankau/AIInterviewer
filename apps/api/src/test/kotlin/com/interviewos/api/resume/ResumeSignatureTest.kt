package com.interviewos.api.resume

import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** An upload's declared type is the browser's claim; the first bytes have to agree with it. */
class ResumeSignatureTest {
    @Test
    fun `real files of each supported type pass`() {
        assertTrue(ResumeSignature.matches("application/pdf", "%PDF-1.7\n...".toByteArray()))
        assertTrue(
            ResumeSignature.matches(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                byteArrayOf(0x50, 0x4B, 0x03, 0x04, 0x14, 0x00),
            ),
        )
        assertTrue(
            ResumeSignature.matches(
                "application/msword",
                byteArrayOf(0xD0.toByte(), 0xCF.toByte(), 0x11, 0xE0.toByte(), 0xA1.toByte(), 0xB1.toByte(), 0x1A, 0xE1.toByte(), 0x00),
            ),
        )
        assertTrue(ResumeSignature.matches("text/plain; charset=utf-8", "Asha Rao\nBackend engineer".toByteArray()))
    }

    @Test
    fun `a file whose bytes disagree with its declared type fails`() {
        assertFalse(ResumeSignature.matches("application/pdf", "<html><script>".toByteArray()))
        assertFalse(ResumeSignature.matches("application/pdf", "%PD".toByteArray()))
        assertFalse(ResumeSignature.matches("application/msword", "%PDF-1.7".toByteArray()))
        assertFalse(ResumeSignature.matches("text/plain", byteArrayOf(0x4D, 0x5A, 0x00, 0x00)))
    }

    @Test
    fun `an unsupported type never matches`() {
        assertFalse(ResumeSignature.matches("image/png", byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47)))
    }
}
