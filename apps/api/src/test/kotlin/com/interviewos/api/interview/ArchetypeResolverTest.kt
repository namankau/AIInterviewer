package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ArchetypeResolverTest {
    private val resolver = ArchetypeResolver()

    @Test
    fun `recognises a global product company`() {
        val resolution = resolver.resolve("Google")

        assertEquals(Archetype.GLOBAL_PRODUCT, resolution.archetype)
        assertEquals(Confidence.RECOGNISED, resolution.confidence)
    }

    @Test
    fun `recognises a service-based IT firm`() {
        assertEquals(Archetype.SERVICE_BASED_IT, resolver.resolve("Infosys").archetype)
        assertEquals(Archetype.SERVICE_BASED_IT, resolver.resolve("TCS").archetype)
    }

    @Test
    fun `is case and whitespace insensitive`() {
        assertEquals(Confidence.RECOGNISED, resolver.resolve("  dELoiTTe  ").confidence)
    }

    @Test
    fun `matches a known name inside a longer one`() {
        assertEquals(Archetype.SERVICE_BASED_IT, resolver.resolve("Infosys BPM").archetype)
        assertEquals(Archetype.GLOBAL_PRODUCT, resolver.resolve("Google India").archetype)
    }

    @Test
    fun `does not match a known name as a substring of a different word`() {
        // "micro1" is a different company; matching it to Microsoft would drop the
        // candidate into the wrong loop entirely.
        val resolution = resolver.resolve("micro1")

        assertEquals(Confidence.INFERRED, resolution.confidence)
    }

    @Test
    fun `falls back to inferred for an unknown employer`() {
        val resolution = resolver.resolve("Ramesh Textiles Private Limited")

        assertEquals(Confidence.INFERRED, resolution.confidence)
    }

    @Test
    fun `infers a plausible archetype from naming conventions`() {
        assertEquals(Archetype.SERVICE_BASED_IT, resolver.resolve("Nimbus Infotech Solutions").archetype)
        assertEquals(Archetype.CONSULTING_BIG_FOUR, resolver.resolve("Harbour Consulting").archetype)
        assertEquals(Archetype.REGULATED_PROFESSIONAL, resolver.resolve("Sunrise Bank").archetype)
        assertEquals(Archetype.INDUSTRIAL_MANUFACTURING, resolver.resolve("Deccan Motors").archetype)
    }

    @Test
    fun `handles an empty company name without failing`() {
        val resolution = resolver.resolve("   ")

        assertEquals(Confidence.INFERRED, resolution.confidence)
    }

    @Test
    fun `grounding for an unknown employer forbids saying anything specific`() {
        val grounding = resolver.resolve("Some Unknown Company").grounding

        assertTrue(grounding.contains("not known to us"))
        assertTrue(grounding.contains("Say nothing specific"))
    }

    @Test
    fun `grounding for a known employer still forbids claiming process knowledge`() {
        // Recognising the name tells us which loop to run. It tells us nothing about
        // that company's current internal process, and the model must not pretend it does.
        val grounding = resolver.resolve("Amazon").grounding

        assertTrue(grounding.contains("You know the archetype, not this company's current internal process"))
        assertTrue(grounding.contains("Never state a specific fact"))
    }
}
