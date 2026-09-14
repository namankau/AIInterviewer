package com.interviewos.api.bank

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * The fingerprint decides what counts as one question, and it is implemented twice: in SQL
 * (what the database stores and the backfill uses) and here (what the extractor dedupes
 * on). If the two disagree, one question becomes two rows and nothing ever fails.
 *
 * So both are checked against the same vectors, written once, in the migration: the
 * migration checks the SQL when it is applied and refuses to apply if any is wrong; this
 * reads them out of that file and checks the Kotlin.
 */
class QuestionFingerprintTest {
    private val vectors: List<Pair<String, String>> =
        QuestionBankMigration.literals(QuestionBankMigration.block("fingerprint-vectors")).chunked(2).map { it[0] to it[1] }

    @Test
    fun `agrees with the SQL definition on every vector the migration checks`() {
        assertTrue(vectors.size >= 10, "expected the migration's vectors, found ${vectors.size}")
        vectors.forEach { (input, expected) ->
            assertEquals(expected, QuestionFingerprint.of(input), "fingerprint of \"$input\"")
        }
    }

    @Test
    fun `treats the same question from two sources as one`() {
        assertEquals(
            QuestionFingerprint.of("Tell me about a time you failed."),
            QuestionFingerprint.of("tell me about a time  you FAILED"),
        )
    }

    @Test
    fun `keeps questions apart that differ in more than punctuation`() {
        assertNotEquals(QuestionFingerprint.of("Explain C++ templates"), QuestionFingerprint.of("Explain C# templates"))
        assertNotEquals(QuestionFingerprint.of("Design Twitter"), QuestionFingerprint.of("Design Instagram"))
    }

    @Test
    fun `reads tabs and newlines as spaces, as the SQL does`() {
        assertEquals("design a url shortener", QuestionFingerprint.of("Design\ta URL\r\nshortener"))
    }

    @Test
    fun `tidying the stored wording never changes which question it is`() {
        val raw = "  Design\t a URL \n shortener?  "
        assertEquals("Design a URL shortener?", QuestionFingerprint.canonicalText(raw))
        assertEquals(QuestionFingerprint.of(raw), QuestionFingerprint.of(QuestionFingerprint.canonicalText(raw)))
    }
}
