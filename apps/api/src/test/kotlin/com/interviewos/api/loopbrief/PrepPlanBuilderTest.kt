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

    @Test
    fun `sourced stages that map to no round still leave a plan, from the general pattern`() {
        // Amazon's own SDE II page, as extracted on 14 September: two real stages, neither
        // of them a single round type. A plan from these alone was empty.
        val sourced =
            listOf(
                sourced(1, "Online Assessment", null),
                sourced(2, "Interview Loop", null),
            )
        val general =
            listOf(
                general(1, "Recruiter screen", RoundType.HR_FIT_CLOSING),
                general(2, "Coding interview", RoundType.CODING_PRACTICAL),
                general(3, "System design interview", RoundType.SYSTEM_DESIGN),
            )

        val plan = PrepPlanBuilder.build(allOffered, PrepPlanBuilder.combine(sourced, general))

        assertThat(plan.items.map { it.roundType })
            .containsExactly(RoundType.HR_FIT_CLOSING, RoundType.CODING_PRACTICAL, RoundType.SYSTEM_DESIGN)
        assertThat(plan.items).allSatisfy { assertThat(it.isSourced).isFalse() }
        assertThat(plan.unsimulatedStages.map { it.stageName }).containsExactly("Online Assessment", "Interview Loop")
    }

    @Test
    fun `a sourced stage wins its round type over the general pattern, and keeps its citation`() {
        val sourced = listOf(sourced(1, "Onsite coding", RoundType.CODING_PRACTICAL))
        val general = listOf(general(1, "Coding interview", RoundType.CODING_PRACTICAL), general(2, "Design", RoundType.SYSTEM_DESIGN))

        val plan = PrepPlanBuilder.build(allOffered, PrepPlanBuilder.combine(sourced, general))

        assertThat(plan.items.map { it.stageName }).containsExactly("Onsite coding", "Design")
        assertThat(plan.items.first().isSourced).isTrue()
        assertThat(plan.items.last().isSourced).isFalse()
    }

    @Test
    fun `with sources present, a general stage we do not simulate adds no second note`() {
        val sourced = listOf(sourced(1, "Online Assessment", null))
        val general = listOf(general(1, "Online assessment", null), general(2, "Coding interview", RoundType.CODING_PRACTICAL))

        val plan = PrepPlanBuilder.build(allOffered, PrepPlanBuilder.combine(sourced, general))

        assertThat(plan.unsimulatedStages.map { it.stageName }).containsExactly("Online Assessment")
    }

    @Test
    fun `a general stage never gains a citation, even if one was passed in`() {
        val leaked = sourced(1, "Coding interview", RoundType.CODING_PRACTICAL)

        val combined = PrepPlanBuilder.combine(emptyList(), listOf(leaked))

        assertThat(combined.single().citations).isEmpty()
    }

    private fun general(
        order: Int,
        stageName: String,
        roundType: RoundType?,
    ) = PlanStageInput(order = order, stageName = stageName, assesses = null, roundType = roundType)

    private fun sourced(
        order: Int,
        stageName: String,
        roundType: RoundType?,
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
