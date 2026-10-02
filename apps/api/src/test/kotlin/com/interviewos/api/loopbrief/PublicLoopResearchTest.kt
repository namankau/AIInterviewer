package com.interviewos.api.loopbrief

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.GroundedClaim
import com.interviewos.api.ai.GroundedEmployerLoop
import com.interviewos.api.ai.GroundedWebSource
import com.interviewos.api.ai.InterviewAi
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Grounded searches are billed per query and their links expire, so the cache in front
 * of them has to be right about three things: one search per burst, no answer kept past
 * its links, and an outage never mistaken for "nothing to find".
 */
class PublicLoopResearchTest {
    private val ai = mock(InterviewAi::class.java)
    private val clock = MutableClock(Instant.parse("2026-10-02T09:00:00Z"))

    private val found =
        GroundedEmployerLoop(
            claims = listOf(GroundedClaim("Sagitec starts with an online aptitude test.", listOf(0))),
            sources = listOf(GroundedWebSource("example.org", "https://example.org/sagitec")),
        )

    @Test
    fun `asks the search with the employer's name and the role's bucket`() {
        given(ai.researchEmployerLoop("Sagitec Solutions", "backend engineer", "mid-level")).willReturn(answer(found))

        val loop = research().patternFor("  Sagitec   Solutions ", "Backend Engineer", null)

        assertEquals(found, loop)
    }

    @Test
    fun `a second candidate for the same employer does not pay for a second search`() {
        given(ai.researchEmployerLoop(anyString(), anyString(), anyString())).willReturn(answer(found))
        val research = research()

        research.patternFor("Sagitec Solutions", "Backend Engineer", null)
        val again = research.patternFor("sagitec solutions", "backend engineer", "")

        assertEquals(found, again)
        verify(ai, times(1)).researchEmployerLoop(anyString(), anyString(), anyString())
    }

    @Test
    fun `an answer is searched again once its links may have expired`() {
        given(ai.researchEmployerLoop(anyString(), anyString(), anyString())).willReturn(answer(found))
        val research = research()

        research.patternFor("Sagitec Solutions", null, null)
        clock.advance(Duration.ofHours(13))
        research.patternFor("Sagitec Solutions", null, null)

        verify(ai, times(2)).researchEmployerLoop(anyString(), anyString(), anyString())
    }

    @Test
    fun `nothing citable is null, and is not searched for again on the next visit`() {
        given(ai.researchEmployerLoop(anyString(), anyString(), anyString())).willReturn(answer(GroundedEmployerLoop()))
        val research = research()

        assertNull(research.patternFor("Tiny Local Firm", null, null))
        assertNull(research.patternFor("Tiny Local Firm", null, null))
        verify(ai, times(1)).researchEmployerLoop(anyString(), anyString(), anyString())
    }

    @Test
    fun `an outage is null and is not remembered as nothing to find`() {
        given(ai.researchEmployerLoop(anyString(), anyString(), anyString()))
            .willThrow(AiUnavailableException("over the spend cap"))
            .willReturn(answer(found))
        val research = research()

        assertNull(research.patternFor("Sagitec Solutions", null, null))
        assertEquals(found, research.patternFor("Sagitec Solutions", null, null))
    }

    @Test
    fun `switched off, no search is made`() {
        val loop = research(PublicLoopResearchProperties(enabled = false)).patternFor("Sagitec Solutions", null, null)

        assertNull(loop)
        verify(ai, never()).researchEmployerLoop(anyString(), anyString(), anyString())
    }

    @Test
    fun `a pasted paragraph is not searched as though it were an employer`() {
        val loop = research().patternFor("a".repeat(121), null, null)

        assertNull(loop)
        verify(ai, never()).researchEmployerLoop(anyString(), anyString(), anyString())
    }

    @Test
    fun `a full cache makes room rather than growing without bound`() {
        given(ai.researchEmployerLoop(anyString(), anyString(), anyString())).willReturn(answer(found))
        val research = research(PublicLoopResearchProperties(maxEntries = 2))

        research.patternFor("First", null, null)
        clock.advance(Duration.ofMinutes(1))
        research.patternFor("Second", null, null)
        clock.advance(Duration.ofMinutes(1))
        research.patternFor("Third", null, null)
        research.patternFor("Third", null, null)
        research.patternFor("Second", null, null)
        research.patternFor("First", null, null)

        // First, Second, Third, then First again: the oldest made way for the newest.
        verify(ai, times(4)).researchEmployerLoop(anyString(), anyString(), anyString())
    }

    private fun research(properties: PublicLoopResearchProperties = PublicLoopResearchProperties()) =
        PublicLoopResearch(ai, properties, clock)

    private fun answer(loop: GroundedEmployerLoop) = AiResult(loop, AiUsage("gemini", 0, 0))

    private class MutableClock(
        private var now: Instant,
    ) : Clock() {
        fun advance(by: Duration) {
            now = now.plus(by)
        }

        override fun instant(): Instant = now

        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId): Clock = this
    }
}
