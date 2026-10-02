package com.interviewos.api.loopbrief

import com.interviewos.api.ai.GeneralLoopPattern
import com.interviewos.api.ai.GeneralLoopStage
import com.interviewos.api.ai.GroundedClaim
import com.interviewos.api.ai.GroundedEmployerLoop
import com.interviewos.api.ai.GroundedWebSource
import com.interviewos.api.bank.BankCitation
import com.interviewos.api.bank.Company
import com.interviewos.api.bank.CompanyCoverage
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.bank.QuestionBankProperties
import com.interviewos.api.bank.QuestionBankRepository
import com.interviewos.api.bank.SourceOrigin
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ArchetypeResolver
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.ArgumentMatchers.nullable
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Which of the brief's three kinds of knowledge is shown, and when.
 *
 * Our own sourced record outranks a web search, a web search is shown only with the
 * pages behind it, and the archetype pattern is always there to fall back on.
 */
class LoopBriefServiceTest {
    private val directory = mock(CompanyDirectory::class.java)
    private val stages = mock(SourceProcessStageRepository::class.java)
    private val patterns = mock(GeneralLoopPatternCache::class.java)
    private val bank = mock(QuestionBankRepository::class.java)
    private val research = mock(PublicLoopResearch::class.java)
    private val archetypes = ArchetypeResolver()

    private val service =
        LoopBriefService(directory, archetypes, stages, patterns, bank, QuestionBankProperties(), research)

    private val general = GeneralLoopPattern(listOf(GeneralLoopStage(order = 1, stageName = "Aptitude test")))

    private val found =
        GroundedEmployerLoop(
            claims =
                listOf(
                    GroundedClaim("Sagitec starts with an online aptitude test.", listOf(0)),
                    GroundedClaim("A technical panel follows.", listOf(0, 1)),
                ),
            sources =
                listOf(
                    GroundedWebSource("example.org", "https://example.org/sagitec"),
                    GroundedWebSource("news.example", "https://news.example/hiring"),
                ),
        )

    @Test
    fun `an employer we hold nothing on gets cited public research beside the archetype pattern`() {
        val archetype = archetypes.resolve("Sagitec Solutions").archetype
        given(patterns.patternFor(archetype, "Backend Engineer", null)).willReturn(general)
        given(research.patternFor("Sagitec Solutions", "Backend Engineer", null)).willReturn(found)

        val brief = service.brief("Sagitec Solutions", "Backend Engineer", null)

        assertFalse(brief.hasSources)
        assertEquals(listOf("Aptitude test"), brief.generalPattern.map { it.stageName })
        val public = brief.publicSourcePattern!!
        assertEquals(listOf("Sagitec starts with an online aptitude test.", "A technical panel follows."), public.claims.map { it.text })
        assertEquals(listOf(listOf(0), listOf(0, 1)), public.claims.map { it.sourceIndexes })
        assertEquals(listOf("https://example.org/sagitec", "https://news.example/hiring"), public.sources.map { it.url })
    }

    @Test
    fun `when the search finds nothing citable the brief stands on the archetype pattern alone`() {
        val archetype = archetypes.resolve("Tiny Local Firm").archetype
        given(patterns.patternFor(archetype, null, null)).willReturn(general)
        given(research.patternFor("Tiny Local Firm", null, null)).willReturn(null)

        val brief = service.brief("Tiny Local Firm", null, null)

        assertNull(brief.publicSourcePattern)
        assertEquals(listOf("Aptitude test"), brief.generalPattern.map { it.stageName })
    }

    @Test
    fun `an employer with a sourced record is not searched for`() {
        val company = company("Infosys", Archetype.SERVICE_BASED_IT)
        given(directory.resolve("Infosys")).willReturn(company)
        given(stages.stagesFor(company.id)).willReturn(listOf(stageRow()))
        given(patterns.patternFor(Archetype.SERVICE_BASED_IT, null, null)).willReturn(general)
        given(bank.coverage(company)).willReturn(CompanyCoverage(company, emptyMap()))

        val brief = service.brief("Infosys", null, null)

        assertTrue(brief.hasSources)
        assertNull(brief.publicSourcePattern)
        verify(research, never()).patternFor(anyString(), nullable(String::class.java), nullable(String::class.java))
    }

    @Test
    fun `an employer we know of but hold no sourced stage for is searched under its own name`() {
        val company = company("Tata Consultancy Services", Archetype.SERVICE_BASED_IT)
        given(directory.resolve("tcs")).willReturn(company)
        given(stages.stagesFor(company.id)).willReturn(emptyList())
        given(patterns.patternFor(Archetype.SERVICE_BASED_IT, null, null)).willReturn(general)
        given(bank.coverage(company)).willReturn(CompanyCoverage(company, emptyMap()))
        given(research.patternFor("Tata Consultancy Services", null, null)).willReturn(found)

        val brief = service.brief("tcs", null, null)

        assertEquals(2, brief.publicSourcePattern?.claims?.size)
    }

    private fun company(
        name: String,
        archetype: Archetype,
    ) = Company(UUID.randomUUID(), name.lowercase().replace(' ', '-'), name, emptyList(), archetype)

    private fun stageRow() =
        SourceProcessStageRow(
            stageName = "Online assessment",
            roleFamily = null,
            stageOrder = 1,
            format = null,
            durationMinutes = null,
            assesses = "Aptitude",
            roundType = null,
            citation =
                BankCitation(
                    sourceId = UUID.randomUUID(),
                    title = "How we hire",
                    publisher = "Infosys",
                    url = "https://example.org/infosys",
                    year = 2025,
                    origin = SourceOrigin.EMPLOYER,
                ),
        )
}
