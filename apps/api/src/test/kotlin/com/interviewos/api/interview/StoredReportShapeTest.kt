package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Reports are composed once and kept forever, so a release that adds a section leaves
 * every earlier report without it. The reader then crashes on the first `.length` — which
 * is exactly what happened: interviews sat before the provenance release could not be
 * opened at all afterwards.
 *
 * This pins the shape the API promises, so adding a section is not a way to break every
 * report that came before it.
 */
class StoredReportShapeTest {
    /** Mirrors ReportService.EMPTY_SECTIONS, which is private to the service. */
    private val emptySections: Map<String, Any?> =
        mapOf(
            "strengths" to emptyList<Any>(),
            "developmentAreas" to emptyList<Any>(),
            "questionSources" to
                mapOf(
                    "entries" to emptyList<Any>(),
                    "employerRecognised" to false,
                    "archetypeLabel" to "",
                    "headline" to "",
                    "disclosure" to "",
                ),
        )

    private fun withEveryField(stored: Map<String, Any?>): Map<String, Any?> = stored + emptySections.filterKeys { it !in stored }

    @Test
    fun `a report written before a section existed gains an empty one`() {
        val old = mapOf<String, Any?>("headline" to "Borderline", "competencies" to emptyList<Any>())

        val filled = withEveryField(old)

        assertEquals(emptyList<Any>(), filled["strengths"])
        assertEquals(emptyList<Any>(), filled["developmentAreas"])
        assertTrue(filled["questionSources"] is Map<*, *>)
    }

    @Test
    fun `what the report actually said is never overwritten`() {
        val real = listOf(mapOf("area" to "Trade-off analysis"))
        val stored = mapOf<String, Any?>("strengths" to real, "headline" to "Strong")

        val filled = withEveryField(stored)

        assertEquals(real, filled["strengths"], "a real section must survive the defaulting")
        assertEquals("Strong", filled["headline"])
    }

    @Test
    fun `an empty section is distinguishable from a missing one only by being present`() {
        // The point of defaulting: the reader can stop guarding every field.
        val filled = withEveryField(emptyMap())

        emptySections.keys.forEach { key ->
            assertTrue(key in filled, "$key must be present so the reader can trust the shape")
        }
    }
}
