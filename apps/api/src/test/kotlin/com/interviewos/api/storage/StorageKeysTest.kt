package com.interviewos.api.storage

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** A file name from the browser must never be able to move a key out of its owner's prefix. */
class StorageKeysTest {
    @Test
    fun `an ordinary name is kept`() {
        assertEquals("Asha_Rao_CV.pdf", StorageKeys.safeFileName("Asha Rao CV.pdf", "resume"))
    }

    @Test
    fun `path segments and traversal are removed`() {
        val unsafe = listOf("../../other-user/cv.pdf", "..\\..\\cv.pdf", "/etc/passwd", "a/../../b.pdf", "..")

        unsafe.forEach { name ->
            val safe = StorageKeys.safeFileName(name, "resume")
            assertFalse('/' in safe || '\\' in safe || ".." in safe, "$name became $safe")
        }
    }

    @Test
    fun `nothing usable falls back`() {
        assertEquals("resume", StorageKeys.safeFileName(null, "resume"))
        assertEquals("resume", StorageKeys.safeFileName("../", "resume"))
    }

    @Test
    fun `long names keep their ending, so the extension survives`() {
        val safe = StorageKeys.safeFileName("x".repeat(200) + ".pdf", "resume")

        assertEquals(80, safe.length)
        assertTrue(safe.endsWith(".pdf"))
    }

    @Test
    fun `stored object keys must be direct children of the expected folder`() {
        assertTrue(StorageKeys.isDirectChildOf("u1/resume.pdf", "u1"))
        assertTrue(StorageKeys.isDirectChildOf("u1/s1/question.wav", "u1/s1"))
        assertFalse(StorageKeys.isDirectChildOf("u2/resume.pdf", "u1"))
        assertFalse(StorageKeys.isDirectChildOf("u1/s1/question.wav", "u1"))
        assertFalse(StorageKeys.isDirectChildOf("u1/../u2/resume.pdf", "u1"))
        assertFalse(StorageKeys.isDirectChildOf("u1/%2e%2e%2fu2", "u1"))
        assertFalse(StorageKeys.isDirectChildOf("u1/", "u1"))
    }
}
