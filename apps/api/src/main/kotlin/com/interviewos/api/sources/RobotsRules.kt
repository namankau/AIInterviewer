package com.interviewos.api.sources

import java.net.URI
import java.net.URISyntaxException

/**
 * Whether a site's robots.txt lets us read a page.
 *
 * This exists because the difference between what the source library is and what
 * `CLAUDE.md` forbids is not a matter of intent — both fetch pages over HTTP. The
 * difference is that this reads only URLs a person explicitly added, never follows a link
 * off the page, and stops when a site says not to. The last of those has to be code.
 *
 * The parser is deliberately small and errs towards *not* fetching. It understands
 * `User-agent`, `Allow` and `Disallow` with `*` wildcards and `$` anchoring, which covers
 * what real files use. Anything it cannot make sense of is treated as a disallow, because
 * the cost of wrongly skipping one page the owner added is a line in a log, and the cost
 * of wrongly fetching one is a product that does the thing it promised not to.
 */
object RobotsRules {
    /** What we identify as. A crawler that hides what it is has already lost the argument. */
    const val USER_AGENT = "AceMyInterviewBot"

    private data class Rule(
        val path: String,
        val allow: Boolean,
    )

    /**
     * Parses [robotsTxt] and returns whether [url] may be fetched.
     *
     * A site with no robots.txt, or one that returns an error, allows everything — that is
     * what the standard says, and callers pass an empty string for it.
     */
    fun allows(
        robotsTxt: String,
        url: String,
    ): Boolean {
        val path =
            try {
                val uri = URI(url)
                (uri.rawPath ?: "/").ifEmpty { "/" } + (uri.rawQuery?.let { "?$it" } ?: "")
            } catch (e: URISyntaxException) {
                // A URL we cannot even parse is not one we should be fetching.
                return false
            } catch (e: IllegalArgumentException) {
                return false
            }

        val rules = rulesFor(robotsTxt)
        if (rules.isEmpty()) return true

        // Longest matching pattern wins, and Allow wins a tie — the documented precedence.
        val best =
            rules
                .filter { matches(it.path, path) }
                .maxWithOrNull(compareBy({ it.path.length }, { it.allow }))
        return best?.allow ?: true
    }

    /**
     * The rules that apply to us: our own user-agent block if there is one, otherwise the
     * wildcard block. A file that names us specifically has been written with us in mind,
     * so it takes precedence over the catch-all.
     */
    private fun rulesFor(robotsTxt: String): List<Rule> {
        val groups = mutableMapOf<String, MutableList<Rule>>()
        var currentAgents = mutableListOf<String>()
        var readingAgents = false

        for (raw in robotsTxt.lineSequence()) {
            val line = raw.substringBefore('#').trim()
            if (line.isEmpty()) continue
            val field = line.substringBefore(':', "").trim().lowercase()
            val value = line.substringAfter(':', "").trim()
            if (field.isEmpty()) continue

            when (field) {
                "user-agent" -> {
                    if (!readingAgents) {
                        currentAgents = mutableListOf()
                        readingAgents = true
                    }
                    currentAgents.add(value.lowercase())
                }

                "allow", "disallow" -> {
                    readingAgents = false
                    if (value.isEmpty() && field == "disallow") continue // "Disallow:" allows all
                    currentAgents.forEach { agent ->
                        groups.getOrPut(agent) { mutableListOf() }.add(Rule(value, field == "allow"))
                    }
                }

                else -> {
                    readingAgents = false
                }
            }
        }

        return groups[USER_AGENT.lowercase()] ?: groups["*"] ?: emptyList()
    }

    /** `*` matches any run of characters; a trailing `$` anchors the end. */
    private fun matches(
        pattern: String,
        path: String,
    ): Boolean {
        if (pattern.isEmpty()) return false
        val anchored = pattern.endsWith("$")
        val body = if (anchored) pattern.dropLast(1) else pattern
        val regex =
            buildString {
                append('^')
                body.split('*').forEachIndexed { index, part ->
                    if (index > 0) append(".*")
                    append(Regex.escape(part))
                }
                if (anchored) append('$')
            }
        return Regex(regex).containsMatchIn(path)
    }
}
