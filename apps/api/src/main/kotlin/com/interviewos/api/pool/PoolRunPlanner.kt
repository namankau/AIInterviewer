package com.interviewos.api.pool

import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ArchetypeResolver
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component

/**
 * Turns "generate for these companies, rounds, roles and levels" into the cells a run is
 * made of.
 *
 * Planning is separate from generating on purpose. The plan is written to the database
 * before a single model call is made, so the size and shape of a run — and therefore
 * roughly what it will cost — can be read and argued with before anything is spent. It is
 * also what makes a resume trivial: the plan does not change, only which of its cells are
 * still pending.
 */
@Component
class PoolRunPlanner(
    private val directory: CompanyDirectory,
    private val archetypes: ArchetypeResolver,
) {
    /**
     * @param companySlugs the employers to generate for. Empty means archetype-level cells
     *   only — questions written for a kind of employer, which is what every company
     *   nobody has generated for falls back to.
     * @param includeArchetypeCells whether to add an archetype-level cell per archetype
     *   alongside the named companies. On by default, because the fallback is what makes
     *   the pool useful for the long tail, and generating only for forty named employers
     *   would leave every other employer exactly where it was.
     */
    fun plan(
        companySlugs: List<String>,
        roundTypes: List<RoundType>,
        roleFamilies: List<RoleFamily>,
        levels: List<Level>,
        includeArchetypeCells: Boolean,
    ): List<PlannedCell> {
        if (roundTypes.isEmpty()) throw ApiException.badRequest("Name at least one round type.", "no_round_types")
        if (roleFamilies.isEmpty()) throw ApiException.badRequest("Name at least one role family.", "no_role_families")
        if (levels.isEmpty()) throw ApiException.badRequest("Name at least one level.", "no_levels")

        val companies =
            companySlugs.map { slug ->
                directory.bySlug(slug)
                    ?: throw ApiException.badRequest("No company with the slug '$slug'.", "unknown_company")
            }

        val cells = mutableListOf<PlannedCell>()

        companies.forEach { company ->
            // The company's recorded archetype where somebody decided it, and the
            // resolver's otherwise — the same answer a live round would get, which is what
            // stops the pool being filed under a different kind of employer from the round
            // that will read it.
            val archetype = company.archetype ?: archetypes.resolve(company.name).archetype
            roundTypes.forEach { round ->
                roleFamilies.forEach { role ->
                    levels.forEach { level ->
                        cells +=
                            PlannedCell(
                                coordinate = PoolCoordinate(company.id, archetype, round, role, level),
                                companyName = company.name,
                            )
                    }
                }
            }
        }

        if (includeArchetypeCells) {
            // The archetypes the named companies fall into, or every archetype when no
            // company was named — an archetype-only run is how the fallback gets filled in
            // for the employers nobody generated for by name, which is most of them.
            val kinds =
                companies
                    .map { it.archetype ?: archetypes.resolve(it.name).archetype }
                    .distinct()
                    .ifEmpty { Archetype.entries.toList() }
            kinds.forEach { archetype ->
                roundTypes.forEach { round ->
                    roleFamilies.forEach { role ->
                        levels.forEach { level ->
                            cells +=
                                PlannedCell(
                                    // No company id and no company name: the employer's
                                    // name never reaches the model for these cells, so it
                                    // cannot invent a detail about one.
                                    coordinate = PoolCoordinate(null, archetype, round, role, level),
                                    companyName = null,
                                )
                        }
                    }
                }
            }
        }

        return cells
    }
}
