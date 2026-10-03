package com.interviewos.api.loopbrief

import com.interviewos.api.ai.GeneralLoopPattern
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verifyNoInteractions
import tools.jackson.databind.ObjectMapper
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CampusLoopPatternTest {
    @Test
    fun `only a stated student or recent graduate is campus`() {
        assertTrue(CampusLoopPattern.isCampus("student"))
        assertTrue(CampusLoopPattern.isCampus(" Recent_Graduate "))
        assertFalse(CampusLoopPattern.isCampus("professional"))
        assertFalse(CampusLoopPattern.isCampus("5 years"))
        assertFalse(CampusLoopPattern.isCampus(""))
        assertFalse(CampusLoopPattern.isCampus(null))
    }

    @Test
    fun `no archetype's campus loop holds a round a fresher is never given`() {
        Archetype.entries.forEach { archetype ->
            val stages = CampusLoopPattern.forArchetype(archetype).stages
            assertTrue(stages.isNotEmpty(), archetype.toString())
            assertEquals(stages.map { it.order }.sorted(), stages.map { it.order }, archetype.toString())
            val types = stages.mapNotNull { it.roundType?.let(RoundType::parseOrNull) }
            assertTrue(types.none { it in CampusLoopPattern.EXCLUDED_FROM_PLAN }, "$archetype: $types")
            assertTrue(RoundType.TECHNICAL_FUNDAMENTALS in types && RoundType.HR_FIT_CLOSING in types, archetype.toString())
        }
    }

    @Test
    fun `service-based IT shows a written test as not spoken, a communication note, then technical and HR`() {
        val stages = CampusLoopPattern.forArchetype(Archetype.SERVICE_BASED_IT).stages

        assertEquals(
            listOf(
                "Written aptitude test",
                "Online coding test",
                "Communication assessment (some employers)",
                "Technical interview",
                "HR interview",
            ),
            stages.map { it.stageName },
        )
        // The online coding test and communication assessment are not rounds we run.
        assertEquals(
            listOf(null, null),
            stages
                .filter {
                    it.stageName.startsWith("Online") || it.stageName.startsWith("Comm")
                }.map { it.roundType },
        )
        assertTrue(stages.first { it.stageName.startsWith("Online coding") }.assesses!!.contains("practise on a coding platform"))
    }

    @Test
    fun `the cache answers a campus level from the fixed pattern without the repository or the model`() {
        val repository = mock(GeneralLoopPatternRepository::class.java)
        val ai = mock(InterviewAi::class.java)
        val cache = GeneralLoopPatternCache(repository, ai, ObjectMapper())

        val pattern: GeneralLoopPattern = cache.patternFor(Archetype.GLOBAL_PRODUCT, "Backend Engineer", "student")

        assertEquals(CampusLoopPattern.forArchetype(Archetype.GLOBAL_PRODUCT), pattern)
        verifyNoInteractions(repository, ai)
    }
}
