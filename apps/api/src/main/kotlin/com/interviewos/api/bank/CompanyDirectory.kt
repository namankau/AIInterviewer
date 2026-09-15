package com.interviewos.api.bank

import com.interviewos.api.interview.Archetype
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import java.sql.ResultSet
import java.util.UUID

/**
 * Which employer a name means. The one place that question is answered.
 *
 * Everything that files or finds a question by company goes through here — the extractor
 * writing reports, the bank's pages, and the grounding a round is given — so "Amazon" can
 * never mean one set of questions on a page and another in a round.
 *
 * Matching is exact: case and whitespace aside, a name must be a company's name or one of
 * its aliases. Never fuzzy, never a prefix, never a word inside a longer name.
 */
@Component
class CompanyDirectory(
    private val jdbcClient: JdbcClient,
) {
    /** The company [name] means, or null when it is not one we hold. */
    fun resolve(name: String): Company? {
        val key = EmployerNames.lookupKey(name)
        if (key.isEmpty()) return null
        val candidates =
            jdbcClient
                .sql(
                    """
                    select $COLUMNS
                      from public.companies c
                     where lower(c.name) = :key
                        or :key = any (c.aliases)
                    """.trimIndent(),
                ).param("key", key)
                .query { rs, _ -> mapRow(rs) }
                .list()
        return EmployerNames.pick(key, candidates)
    }

    fun bySlug(slug: String): Company? =
        jdbcClient
            .sql("select $COLUMNS from public.companies c where c.slug = :slug")
            .param("slug", slug.trim().lowercase())
            .query { rs, _ -> mapRow(rs) }
            .optional()
            .orElse(null)

    /**
     * The company [name] means, creating it if we have never heard of it.
     *
     * Only for the extractor: the name came from a real document, which is what licenses
     * adding it. Returns null for a name that is not an employer at all — a group like
     * "FAANG", or a sentence — because inventing a company is worse than an untagged report.
     */
    fun resolveOrCreate(name: String): Company? {
        if (!EmployerNames.isNamedEmployer(name)) return null
        resolve(name)?.let { return it }

        val display = EmployerNames.displayName(name)
        val base = EmployerNames.slugFor(display)
        for (attempt in 1..MAX_SLUG_ATTEMPTS) {
            val slug = if (attempt == 1) base else "$base-$attempt"
            // Conflicts on slug or on name are both "not this one": a name conflict means
            // another thread created the same company a moment ago, and resolve() finds it.
            val created =
                jdbcClient
                    .sql(
                        """
                        insert into public.companies (slug, name)
                        values (:slug, :name)
                        on conflict do nothing
                        returning $COLUMNS_BARE
                        """.trimIndent(),
                    ).param("slug", slug)
                    .param("name", display)
                    .query { rs, _ -> mapRow(rs) }
                    .optional()
                    .orElse(null)
            if (created != null) return created
            resolve(display)?.let { return it }
        }
        return null
    }

    companion object {
        /** Selected from `public.companies c`. Shared with [QuestionBankRepository]. */
        const val COLUMNS = "c.id, c.slug, c.name, c.aliases, c.archetype::text as archetype"
        private const val COLUMNS_BARE = "id, slug, name, aliases, archetype::text as archetype"
        private const val MAX_SLUG_ATTEMPTS = 20

        internal fun mapRow(rs: ResultSet): Company {
            @Suppress("UNCHECKED_CAST")
            val aliases = (rs.getArray("aliases")?.array as? Array<String>)?.toList() ?: emptyList()
            return Company(
                id = rs.getObject("id", UUID::class.java),
                slug = rs.getString("slug"),
                name = rs.getString("name"),
                aliases = aliases,
                archetype = rs.getString("archetype")?.let { Archetype.fromDbValue(it) },
            )
        }
    }
}
