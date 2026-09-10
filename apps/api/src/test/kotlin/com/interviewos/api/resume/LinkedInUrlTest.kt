package com.interviewos.api.resume

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * The parser reads this off a PDF, so it arrives in whatever shape the candidate typed it
 * into their own document. Storing a wrong one is worse than storing none: an empty box is
 * obviously unfilled, and a wrong one looks like a considered answer.
 */
class LinkedInUrlTest {
    @Test
    fun `takes a profile URL as printed`() {
        assertEquals(
            "https://www.linkedin.com/in/priya-sharma",
            LinkedInUrl.parse("https://www.linkedin.com/in/priya-sharma"),
        )
    }

    /** How resumes actually print it: no scheme, and often a trailing slash. */
    @Test
    fun `adds the scheme resumes leave off`() {
        assertEquals("https://linkedin.com/in/priya-sharma", LinkedInUrl.parse("linkedin.com/in/priya-sharma"))
        assertEquals("https://www.linkedin.com/in/priya", LinkedInUrl.parse("www.linkedin.com/in/priya/"))
    }

    @Test
    fun `accepts a country subdomain`() {
        assertEquals("https://in.linkedin.com/in/priya", LinkedInUrl.parse("in.linkedin.com/in/priya"))
    }

    @Test
    fun `refuses somewhere that is not LinkedIn`() {
        assertNull(LinkedInUrl.parse("https://github.com/priya"))
        assertNull(LinkedInUrl.parse("https://priya.dev"))
        assertNull(LinkedInUrl.parse("https://notlinkedin.com/in/priya"))
    }

    /**
     * A model that could not find a URL sometimes returns the word next to it instead.
     * That is not a profile and must not be shown back as one.
     */
    @Test
    fun `refuses a word that is not a URL`() {
        assertNull(LinkedInUrl.parse("LinkedIn"))
        assertNull(LinkedInUrl.parse("see my profile"))
    }

    /** The site is not a person. */
    @Test
    fun `refuses the bare site`() {
        assertNull(LinkedInUrl.parse("https://www.linkedin.com"))
        assertNull(LinkedInUrl.parse("linkedin.com/"))
    }

    @Test
    fun `nothing in, nothing out`() {
        assertNull(LinkedInUrl.parse(null))
        assertNull(LinkedInUrl.parse(""))
        assertNull(LinkedInUrl.parse("   "))
    }
}
