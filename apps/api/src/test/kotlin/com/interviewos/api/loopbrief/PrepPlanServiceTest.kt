package com.interviewos.api.loopbrief

import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.GeneralLoopStage
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.Confidence
import com.interviewos.api.interview.ReadinessService
import com.interviewos.api.interview.RoundsProperties
import com.interviewos.api.resume.ResumeService
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Which loop the plan is built from when we hold no sourced stage for the employer. */
class PrepPlanServiceTest {
    private val loopBrief = mock(LoopBriefService::class.java)
    private val service =
        PrepPlanService(loopBrief, mock(ResumeService::class.java), mock(ReadinessService::class.java), RoundsProperties())
    private val user = UUID.randomUUID()

    private val general =
        listOf(
            GeneralLoopStage(order = 1, stageName = "Recruiter Screen", roundType = "hr_fit_closing"),
            GeneralLoopStage(order = 2, stageName = "Client Scenario Round", roundType = "case_client_scenario"),
        )

    @Test
    fun `the rounds the model named for the employer replace the archetype pattern, untopped-up`() {
        given(loopBrief.resolveLoop("Infosys", null, null)).willReturn(
            loop(
                EmployerKnowledge(
                    knowsProcess = true,
                    namedRounds = listOf("Online assessment", "Technical interview", "HR interview"),
                ),
            ),
        )

        val plan = service.plan(user, "Infosys", null, null)

        assertEquals(listOf("technical_fundamentals", "hr_fit_closing"), plan.items.map { it.roundType })
        assertTrue(plan.items.all { "as the AI knows it" in it.why }, plan.items.map { it.why }.toString())
        assertEquals(listOf("Online assessment"), plan.unsimulatedStages.map { it.stageName })
    }

    @Test
    fun `knowledge that names no round we run falls back to the archetype pattern`() {
        given(loopBrief.resolveLoop("Infosys", null, null)).willReturn(
            loop(EmployerKnowledge(knowsProcess = true, namedRounds = listOf("Online assessment"))),
        )

        val plan = service.plan(user, "Infosys", null, null)

        assertEquals(listOf("hr_fit_closing", "case_client_scenario"), plan.items.map { it.roundType })
        assertTrue(plan.items.all { it.why.startsWith("Typical of") })
    }

    @Test
    fun `a campus plan drops system design, techno-managerial and client rounds even when the model named them`() {
        given(loopBrief.resolveLoop("Infosys", null, "student")).willReturn(
            loop(
                EmployerKnowledge(
                    knowsProcess = true,
                    namedRounds =
                        listOf("Technical interview", "Managerial round", "System design round", "Client scenario round", "HR interview"),
                ),
                campus = true,
            ),
        )

        val plan = service.plan(user, "Infosys", null, "student")

        assertEquals(listOf("technical_fundamentals", "hr_fit_closing"), plan.items.map { it.roundType })
    }

    @Test
    fun `the same loop unset keeps the experienced rounds`() {
        given(loopBrief.resolveLoop("Infosys", null, null)).willReturn(
            loop(
                EmployerKnowledge(
                    knowsProcess = true,
                    namedRounds = listOf("Technical interview", "Managerial round", "HR interview"),
                ),
            ),
        )

        val plan = service.plan(user, "Infosys", null, null)

        assertEquals(listOf("technical_fundamentals", "techno_managerial", "hr_fit_closing"), plan.items.map { it.roundType })
    }

    @Test
    fun `a campus plan built from the campus pattern is labelled as campus hiring and keeps the written test as a pointer`() {
        val campusStages = CampusLoopPattern.forArchetype(Archetype.SERVICE_BASED_IT).stages
        given(loopBrief.resolveLoop("Infosys", null, "student")).willReturn(loop(null, campus = true).copy(generalPattern = campusStages))

        val plan = service.plan(user, "Infosys", null, "student")

        assertEquals(listOf("aptitude", "technical_fundamentals", "hr_fit_closing"), plan.items.map { it.roundType })
        assertTrue(plan.items.all { it.why.startsWith("Typical of campus hiring") }, plan.items.map { it.why }.toString())
        assertEquals(listOf("Online coding test", "Communication assessment (some employers)"), plan.unsimulatedStages.map { it.stageName })
        assertTrue("coding platform" in plan.unsimulatedStages.first().note)
    }

    private fun loop(
        knowledge: EmployerKnowledge?,
        campus: Boolean = false,
    ) = ResolvedLoop(
        company = null,
        typedName = "Infosys",
        archetype = Archetype.SERVICE_BASED_IT,
        confidence = Confidence.RECOGNISED,
        sourcedStages = emptyList(),
        generalPattern = general,
        modelKnowledge = knowledge,
        campus = campus,
    )
}
