package com.interviewos.api.loopbrief

import com.interviewos.api.bank.BankCitation
import com.interviewos.api.bank.SourceOrigin
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

class PrepPlanBuilderTest {
    private val allOffered = RoundType.entries.toSet()

    @Test
    fun `drops a stage whose round type this product does not offer`() {
        val stages =
            listOf(
                sourced(1, "Coding round", RoundType.CODING_PRACTICAL),
                sourced(2, "Case round", RoundType.CASE_CLIENT_SCENARIO),
            )

        val plan = PrepPlanBuilder.build(setOf(RoundType.CODING_PRACTICAL), stages)

        assertThat(plan.items).extracting<RoundType> { it.roundType }.containsExactly(RoundType.CODING_PRACTICAL)
    }

    @Test
    fun `a stage from the general pattern never carries a citation`() {
        val general = PlanStageInput(order = 1, stageName = "System design", assesses = null, roundType = RoundType.SYSTEM_DESIGN)

        val plan = PrepPlanBuilder.build(allOffered, listOf(general))

        assertThat(plan.items.single().isSourced).isFalse()
        assertThat(plan.items.single().citations).isEmpty()
    }

    @Test
    fun `a sourced stage keeps its citation and is marked sourced`() {
        val stage = sourced(1, "Coding round", RoundType.CODING_PRACTICAL)

        val plan = PrepPlanBuilder.build(allOffered, listOf(stage))

        assertThat(plan.items.single().isSourced).isTrue()
        assertThat(plan.items.single().citations).isNotEmpty()
    }

    @Test
    fun `a stage with no round type becomes an unsimulated stage, not a dropped one`() {
        val onlineAssessment = PlanStageInput(order = 1, stageName = "Online assessment", assesses = null, roundType = null)

        val plan = PrepPlanBuilder.build(allOffered, listOf(onlineAssessment))

        assertThat(plan.items).isEmpty()
        assertThat(plan.unsimulatedStages.single().stageName).isEqualTo("Online assessment")
        assertThat(plan.unsimulatedStages.single().note).isNotBlank()
    }

    @Test
    fun `two stages mapping to the same round type produce one plan item`() {
        val stages =
            listOf(
                sourced(1, "Phone screen", RoundType.CODING_PRACTICAL),
                sourced(2, "Onsite coding", RoundType.CODING_PRACTICAL),
            )

        val plan = PrepPlanBuilder.build(allOffered, stages)

        assertThat(plan.items).hasSize(1)
        assertThat(plan.items.single().stageName).isEqualTo("Phone screen")
    }

    @Test
    fun `stages are offered in loop order`() {
        val stages =
            listOf(
                sourced(2, "Onsite", RoundType.SYSTEM_DESIGN),
                sourced(1, "Screen", RoundType.CODING_PRACTICAL),
            )

        val plan = PrepPlanBuilder.build(allOffered, stages)

        assertThat(plan.items.map { it.roundType }).containsExactly(RoundType.CODING_PRACTICAL, RoundType.SYSTEM_DESIGN)
    }

    private fun sourced(
        order: Int,
        stageName: String,
        roundType: RoundType,
    ) = PlanStageInput(
        order = order,
        stageName = stageName,
        assesses = "Approach, edge cases, complexity",
        roundType = roundType,
        citations =
            listOf(
                BankCitation(
                    sourceId = UUID.randomUUID(),
                    title = "How we hire",
                    publisher = "Employer",
                    url = "https://example.com",
                    year = 2024,
                    origin = SourceOrigin.EMPLOYER,
                ),
            ),
    )
}
