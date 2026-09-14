package com.interviewos.api.bank

import java.text.Normalizer
import java.util.Locale

/**
 * The rules for turning an employer name, as a document or an operator wrote it, into
 * something the directory can look up. Pure, so every rule here is unit-tested without a
 * database.
 *
 * **Exact, never fuzzy.** Case and runs of whitespace are ignored and nothing else is:
 * "Google Cloud India" does not resolve to Google, because a looser match would file one
 * employer's questions under another's name — the fabricated specificity `CLAUDE.md` calls
 * the most damaging failure this product has.
 */
object EmployerNames {
    /** Longer than any real employer name; a sentence the model mistook for one. */
    const val MAX_LENGTH = 80

    /** The key a name is looked up by: trimmed, whitespace collapsed, lower-cased. */
    fun lookupKey(name: String): String = displayName(name).lowercase(Locale.ROOT)

    /** How a new company is named: as written, with whitespace tidied. */
    fun displayName(name: String): String = name.replace(WHITESPACE, " ").trim(' ')

    /**
     * Whether [name] names an employer at all.
     *
     * Groups are not employers. "FAANG", "big tech" and "product companies" describe a
     * set of companies, and a tag is a claim that one particular employer asked: filing a
     * question under a group would either invent a company called FAANG or, worse, spread
     * the claim across every member. The extractor is told this; this list is the
     * backstop for when it does not listen. Mirrored in the migration's backfill.
     */
    fun isNamedEmployer(name: String?): Boolean {
        if (name == null) return false
        val display = displayName(name)
        if (display.isEmpty() || display.length > MAX_LENGTH) return false
        val normalised = groupKey(display)
        if (normalised.isEmpty() || normalised in GROUPS) return false
        return normalised.split(' ').none { it in GROUP_WORDS }
    }

    /**
     * A URL slug for a new company: accents folded, anything else not a-z or 0-9 becomes a
     * hyphen. A name with no Latin letters at all gets a stable hash-based slug instead.
     */
    fun slugFor(name: String): String {
        val folded =
            Normalizer
                .normalize(displayName(name), Normalizer.Form.NFD)
                .replace(COMBINING_MARKS, "")
                .lowercase(Locale.ROOT)
        val slug =
            folded
                .replace(NOT_SLUG, "-")
                .trim('-')
                .take(MAX_SLUG)
                .trim('-')
        if (slug.isNotEmpty()) return slug
        val hash =
            java.security.MessageDigest
                .getInstance("MD5")
                .digest(name.toByteArray())
        return "company-" + hash.take(4).joinToString("") { "%02x".format(it) }
    }

    /**
     * Which of the companies a lookup found is the one meant.
     *
     * A name match wins outright. Failing that, an alias match — but only if exactly one
     * company claims the alias: two employers sharing an alias is a curation mistake, and
     * the safe answer to an ambiguous name is no answer rather than a guess.
     */
    fun pick(
        key: String,
        candidates: List<Company>,
    ): Company? {
        candidates.firstOrNull { it.name.lowercase(Locale.ROOT) == key }?.let { return it }
        val byAlias = candidates.filter { key in it.aliases }
        return byAlias.singleOrNull()
    }

    /** Lower-cased, every run of non a-z/0-9 a single space. Also what the backfill uses. */
    private fun groupKey(name: String): String = name.lowercase(Locale.ROOT).replace(NOT_ALNUM, " ").trim(' ')

    /** Whole names that describe a set of employers, or none. Same list as the migration. */
    val GROUPS: List<String> =
        listOf(
            "big tech",
            "big 4",
            "big four",
            "big 3",
            "big three",
            "mbb",
            "fortune 500",
            "fortune 100",
            "product companies",
            "product company",
            "product based companies",
            "product based company",
            "service companies",
            "service based companies",
            "service based company",
            "it companies",
            "mnc",
            "mncs",
            "startup",
            "startups",
            "a startup",
            "unicorn",
            "unicorns",
            "tech companies",
            "top tech companies",
            "tech giants",
            "top companies",
            "tier 1 companies",
            "various companies",
            "multiple companies",
            "several companies",
            "many companies",
            "the company",
            "company",
            "companies",
            "unknown",
            "not specified",
            "unspecified",
            "undisclosed",
            "confidential",
            "anonymous",
            "n a",
            "na",
            "none",
        )

    /** Acronyms for groups, rejected wherever they appear: "FAANG+ companies" too. */
    val GROUP_WORDS: List<String> = listOf("faang", "maang", "manga", "gafam", "gafa")

    private const val MAX_SLUG = 60
    private val WHITESPACE = Regex("[\\x09-\\x0d\\x20]+")
    private val NOT_ALNUM = Regex("[^a-z0-9]+")
    private val NOT_SLUG = Regex("[^a-z0-9]+")
    private val COMBINING_MARKS = Regex("\\p{M}+")
}
