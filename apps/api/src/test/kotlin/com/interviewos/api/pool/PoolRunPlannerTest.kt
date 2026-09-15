package com.interviewos.api.pool

import com.interviewos.api.bank.Company
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ArchetypeResolver
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import java.util.UUID

class PoolRunPlannerTest {
    private val directory = mock(CompanyDirectory::class.java)
    private val planner = PoolRunPlanner(directory, ArchetypeResolver())

    private val amazon =
        Company(
            id = UUID.fromString("66666666-6666-6666-6666-666666666666"),
            slug = "amazon",
            name = "Amazon",
            aliases = listOf("amazon.com"),
            archetype = Archetype.GLOBAL_PRODUCT,
        )

    // Seeded with no archetype on purpose (task 035 only sets one where the routing table
    // already decides it), so the resolver has to supply one.
    private val stripe =
        Company(
            id = UUID.fromString("77777777-7777-7777-7777-777777777777"),
            slug = "stripe",
            name = "Stripe",
            aliases = emptyList(),
            archetype = null,
        )

    @Test
    fun `a cell per company per round per role per level`() {
        given(directory.bySlug("amazon")).willReturn(amazon)

        val cells =
            planner.plan(
                companySlugs = listOf("amazon"),
                roundTypes = listOf(RoundType.HR_FIT_CLOSING),
                roleFamilies = listOf(RoleFamily.BACKEND, RoleFamily.SRE),
                levels = listOf(Level.MID, Level.SENIOR),
                includeArchetypeCells = false,
            )

        assertThat(cells).hasSize(4)
        assertThat(cells.map { it.companyName }).containsOnly("Amazon")
        assertThat(cells.map { it.coordinate.archetype }).containsOnly(Archetype.GLOBAL_PRODUCT)
    }

    @Test
    fun `archetype cells carry no company name, so the model is never told the employer`() {
        given(directory.bySlug("amazon")).willReturn(amazon)

        val cells =
            planner.plan(
                companySlugs = listOf("amazon"),
                roundTypes = listOf(RoundType.HR_FIT_CLOSING),
                roleFamilies = listOf(RoleFamily.BACKEND),
                levels = listOf(Level.MID),
                includeArchetypeCells = true,
            )

        val fallback = cells.filter { it.coordinate.companyId == null }
        assertThat(fallback).hasSize(1)
        assertThat(fallback.single().companyName).isNull()
        assertThat(fallback.single().coordinate.archetype).isEqualTo(Archetype.GLOBAL_PRODUCT)
    }

    @Test
    fun `a company with no recorded archetype gets the resolver's, not a guess of our own`() {
        given(directory.bySlug("stripe")).willReturn(stripe)

        val cells =
            planner.plan(
                companySlugs = listOf("stripe"),
                roundTypes = listOf(RoundType.HR_FIT_CLOSING),
                roleFamilies = listOf(RoleFamily.BACKEND),
                levels = listOf(Level.MID),
                includeArchetypeCells = false,
            )

        assertThat(cells.single().coordinate.archetype)
            .isEqualTo(ArchetypeResolver().resolve("Stripe").archetype)
    }

    @Test
    fun `a run with no company named plans the archetype fallback for every kind of employer`() {
        val cells =
            planner.plan(
                companySlugs = emptyList(),
                roundTypes = listOf(RoundType.HR_FIT_CLOSING),
                roleFamilies = listOf(RoleFamily.BACKEND),
                levels = listOf(Level.MID),
                includeArchetypeCells = true,
            )

        assertThat(cells).hasSize(Archetype.entries.size)
        assertThat(cells.map { it.coordinate.companyId }).containsOnlyNulls()
    }

    @Test
    fun `an unknown company slug is refused rather than invented`() {
        given(directory.bySlug("acme")).willReturn(null)

        assertThatThrownBy {
            planner.plan(
                companySlugs = listOf("acme"),
                roundTypes = listOf(RoundType.HR_FIT_CLOSING),
                roleFamilies = listOf(RoleFamily.BACKEND),
                levels = listOf(Level.MID),
                includeArchetypeCells = false,
            )
        }.isInstanceOf(ApiException::class.java)
    }

    @Test
    fun `a run with no round types is refused`() {
        assertThatThrownBy {
            planner.plan(emptyList(), emptyList(), listOf(RoleFamily.BACKEND), listOf(Level.MID), false)
        }.isInstanceOf(ApiException::class.java)
    }
}
