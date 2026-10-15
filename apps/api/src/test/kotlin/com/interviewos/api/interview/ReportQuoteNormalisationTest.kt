package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ReportQuoteNormalisationTest {
    @Test
    fun `a Devanagari evidence quote remains searchable in its transcript`() {
        val transcript = "मैंने पहले समस्या समझी, फिर टीम के साथ समाधान बनाया।"
        val quote = "समस्या समझी, फिर टीम के साथ समाधान"

        assertTrue(transcript.normaliseForMatch().contains(quote.normaliseForMatch()))
        assertTrue(quote.normaliseForMatch().contains("समस्या"))
    }

    @Test
    fun `composed and decomposed Unicode match without removing script marks`() {
        assertEquals("naïve समाधान", "NAÏVE, समाधान".normaliseForMatch())
        assertEquals("naïve समाधान", "nai\u0308ve समाधान".normaliseForMatch())
        assertEquals("मैं", "मैं".normaliseForMatch())
    }

    @Test
    fun `different Hindi words and empty quotes cannot be grounded accidentally`() {
        assertFalse("मैं घर गया".normaliseForMatch().contains("मैं घर गयी".normaliseForMatch()))
        assertEquals("", "। ! ?".normaliseForMatch())
    }
}
