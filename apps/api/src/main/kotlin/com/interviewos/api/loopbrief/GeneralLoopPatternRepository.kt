package com.interviewos.api.loopbrief

import com.interviewos.api.interview.Archetype
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

/**
 * The cache table behind the loop brief's general pattern.
 *
 * Keyed on (archetype, role family, level) and nothing about any one candidate or
 * company — the model that writes the payload is never told which employer it is
 * describing (`InterviewAi.composeLoopPattern`), so the same cached answer is correct
 * for everyone in that bucket. That is what makes the cache sound, and it is what keeps
 * this call close to free after the first candidate in a bucket pays for it.
 */
@Repository
class GeneralLoopPatternRepository(
    private val jdbcClient: JdbcClient,
) {
    fun find(
        archetype: Archetype,
        roleFamily: String,
        levelBand: String,
    ): String? =
        jdbcClient
            .sql(
                """
                select payload::text as payload
                  from public.general_loop_patterns
                 where archetype = cast(:archetype as public.employer_archetype)
                   and role_family = :role
                   and level_band = :level
                """.trimIndent(),
            ).param("archetype", archetype.dbValue)
            .param("role", roleFamily)
            .param("level", levelBand)
            .query(String::class.java)
            .optional()
            .orElse(null)

    fun save(
        archetype: Archetype,
        roleFamily: String,
        levelBand: String,
        payloadJson: String,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.general_loop_patterns (archetype, role_family, level_band, payload)
                values (cast(:archetype as public.employer_archetype), :role, :level, cast(:payload as jsonb))
                on conflict (archetype, role_family, level_band) do update
                   set payload = excluded.payload,
                       updated_at = now()
                """.trimIndent(),
            ).param("archetype", archetype.dbValue)
            .param("role", roleFamily)
            .param("level", levelBand)
            .param("payload", payloadJson)
            .update()
    }
}

/**
 * Normalises the bucket a candidate's role and level fall into, so "Backend Engineer"
 * and "backend engineer" share one cached row.
 */
object LoopBucket {
    fun roleFamily(role: String?): String = role?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: "general"

    fun levelBand(level: String?): String = level?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: "mid-level"
}
