package com.interviewos.api.loopbrief

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.InterviewAi
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * The model's own knowledge is shown only when it names something, and is asked once
 * per employer rather than once per candidate.
 */
class ModelEmployerKnowledgeTest {
    private val ai = mock(InterviewAi::class.java)
    private val clock = Clock.fixed(Instant.parse("2026-10-03T09:00:00Z"), ZoneOffset.UTC)

    private val known =
        EmployerKnowledge(
            knowsProcess = true,
            basis = "Widely described campus process; may be dated.",
            namedRounds = listOf("Online assessment", " Technical interview ", ""),
            namedFormats = listOf("HR interview"),
        )

    @Test
    fun `an employer the model can name specifics for is returned, trimmed`() {
        given(ai.assessEmployerKnowledge("Infosys", "Service-based IT")).willReturn(answer(known))

        val knowledge = knowledge().knowledgeOf("  Infosys ", "Service-based IT")!!

        assertEquals(listOf("Online assessment", "Technical interview"), knowledge.namedRounds)
        assertEquals(listOf("HR interview"), knowledge.namedFormats)
    }

    @Test
    fun `claiming to know the process without naming anything is not shown`() {
        given(ai.assessEmployerKnowledge(anyString(), anyString()))
            .willReturn(answer(EmployerKnowledge(knowsProcess = true, basis = "I know them well.")))

        assertNull(knowledge().knowledgeOf("Infosys", "Service-based IT"))
    }

    @Test
    fun `naming things while saying it does not know the process is not shown`() {
        given(ai.assessEmployerKnowledge(anyString(), anyString()))
            .willReturn(answer(known.copy(knowsProcess = false)))

        assertNull(knowledge().knowledgeOf("Infosys", "Service-based IT"))
    }

    @Test
    fun `a second candidate for the same employer does not pay for a second call, even when the answer was no`() {
        given(ai.assessEmployerKnowledge(anyString(), anyString())).willReturn(answer(EmployerKnowledge()))
        val knowledge = knowledge()

        assertNull(knowledge.knowledgeOf("Tiny Local Firm", "Service-based IT"))
        assertNull(knowledge.knowledgeOf("tiny local firm", "Service-based IT"))
        verify(ai, times(1)).assessEmployerKnowledge(anyString(), anyString())
    }

    @Test
    fun `an outage is null and is not remembered as the model knowing nothing`() {
        given(ai.assessEmployerKnowledge(anyString(), anyString()))
            .willThrow(AiUnavailableException("over the spend cap"))
            .willReturn(answer(known))
        val knowledge = knowledge()

        assertNull(knowledge.knowledgeOf("Infosys", "Service-based IT"))
        assertEquals(known.basis, knowledge.knowledgeOf("Infosys", "Service-based IT")?.basis)
    }

    @Test
    fun `switched off, the model is not asked`() {
        val knowledge = knowledge(ModelEmployerKnowledgeProperties(enabled = false))

        assertNull(knowledge.knowledgeOf("Infosys", "Service-based IT"))
        verify(ai, never()).assessEmployerKnowledge(anyString(), anyString())
    }

    private fun knowledge(properties: ModelEmployerKnowledgeProperties = ModelEmployerKnowledgeProperties()) =
        ModelEmployerKnowledge(ai, properties, clock)

    private fun answer(knowledge: EmployerKnowledge) = AiResult(knowledge, AiUsage("gemini", 0, 0))
}
