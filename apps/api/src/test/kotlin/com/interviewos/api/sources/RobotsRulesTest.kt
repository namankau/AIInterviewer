package com.interviewos.api.sources

import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The line between a curated reading list and a crawler is enforced here, so these tests
 * are about the cases where getting it wrong would be embarrassing rather than the happy
 * path.
 */
class RobotsRulesTest {
    @Test
    fun `a site with no robots file allows everything`() {
        assertTrue(RobotsRules.allows("", "https://example.com/interviews/google"))
    }

    @Test
    fun `a blanket disallow is honoured`() {
        val robots =
            """
            User-agent: *
            Disallow: /
            """.trimIndent()

        assertFalse(RobotsRules.allows(robots, "https://example.com/anything"))
    }

    @Test
    fun `a disallowed subtree is honoured while the rest of the site is not`() {
        val robots =
            """
            User-agent: *
            Disallow: /private/
            """.trimIndent()

        assertFalse(RobotsRules.allows(robots, "https://example.com/private/notes"))
        assertTrue(RobotsRules.allows(robots, "https://example.com/blog/interviewing"))
    }

    @Test
    fun `a rule naming us beats the wildcard block`() {
        val robots =
            """
            User-agent: *
            Disallow:

            User-agent: AceMyInterviewBot
            Disallow: /
            """.trimIndent()

        assertFalse(
            RobotsRules.allows(robots, "https://example.com/blog"),
            "a file that names us has been written with us in mind",
        )
    }

    @Test
    fun `the longest matching rule wins, so a carve-out inside a disallow is respected`() {
        val robots =
            """
            User-agent: *
            Disallow: /docs/
            Allow: /docs/public/
            """.trimIndent()

        assertFalse(RobotsRules.allows(robots, "https://example.com/docs/internal"))
        assertTrue(RobotsRules.allows(robots, "https://example.com/docs/public/guide"))
    }

    @Test
    fun `an empty disallow means allow everything, as the standard says`() {
        val robots =
            """
            User-agent: *
            Disallow:
            """.trimIndent()

        assertTrue(RobotsRules.allows(robots, "https://example.com/anything"))
    }

    @Test
    fun `wildcards and end-anchors are understood`() {
        val robots =
            """
            User-agent: *
            Disallow: /*.pdf${'$'}
            """.trimIndent()

        assertFalse(RobotsRules.allows(robots, "https://example.com/files/report.pdf"))
        assertTrue(RobotsRules.allows(robots, "https://example.com/files/report.html"))
    }

    @Test
    fun `comments and casing do not confuse it`() {
        val robots =
            """
            # our rules
            USER-AGENT: *
            DISALLOW: /private/   # keep out
            """.trimIndent()

        assertFalse(RobotsRules.allows(robots, "https://example.com/private/x"))
    }

    /**
     * Errs towards not fetching. Wrongly skipping a page the owner added costs a line in
     * a log; wrongly fetching one costs the claim that this is not a crawler.
     */
    @Test
    fun `a URL that cannot be parsed is not fetched`() {
        assertFalse(RobotsRules.allows("", "not a url at all"))
    }
}
