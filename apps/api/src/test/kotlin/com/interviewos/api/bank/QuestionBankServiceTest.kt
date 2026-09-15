package com.interviewos.api.bank

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ArchetypeResolver
import com.interviewos.api.interview.RoundType
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.springframework.http.HttpStatus
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals

class QuestionBankServiceTest {
    private val directory = mock(CompanyDirectory::class.java)
    private val bank = mock(QuestionBankRepository::class.java)
    private val service = QuestionBankService(directory, bank, ArchetypeResolver())

    private val amazon = Company(UUID.randomUUID(), "amazon", "Amazon", listOf("amazon.com"), Archetype.GLOBAL_PRODUCT)
    private val microsoft = Company(UUID.randomUUID(), "microsoft", "Microsoft", emptyList(), Archetype.GLOBAL_PRODUCT)

    /** The owner's example: filtering by Amazon still shows that a question also carries Microsoft. */
    @Test
    fun `a question filtered by one company still carries every company it is reported at`() {
        val question =
            BankQuestion(
                id = UUID.randomUUID(),
                text = "Design a rate limiter",
                roundType = RoundType.SYSTEM_DESIGN,
                companies = listOf(CompanyTag(amazon, 2, LocalDate.of(2025, 1, 1)), CompanyTag(microsoft, 1, null)),
                citations = emptyList(),
                corroboration = 3,
                lastReported = LocalDate.of(2025, 1, 1),
                notes = null,
            )
        given(directory.bySlug("amazon")).willReturn(amazon)
        given(bank.coverage(amazon)).willReturn(CompanyCoverage(amazon, mapOf(RoundType.SYSTEM_DESIGN to 1)))
        given(bank.questionsFor(amazon.id, RoundType.SYSTEM_DESIGN, false, 20, 0)).willReturn(listOf(question))
        given(bank.countFor(amazon.id, RoundType.SYSTEM_DESIGN, false)).willReturn(1)

        val page = service.page("amazon", "system_design", 20, 0)

        assertEquals(
            listOf("amazon", "microsoft"),
            page.questions
                .single()
                .companies
                .map { it.slug },
        )
        assertEquals("published_source", page.questions.single().tier)
    }

    @Test
    fun `a company with nothing sourced is an empty page that still names its archetype`() {
        // Seeded without an archetype: the page must describe the loop a round would run,
        // which is the resolver's inferred one.
        val nvidia = Company(UUID.randomUUID(), "nvidia", "Nvidia", emptyList(), null)
        given(directory.bySlug("nvidia")).willReturn(nvidia)
        given(bank.coverage(nvidia)).willReturn(CompanyCoverage(nvidia, emptyMap()))
        given(bank.questionsFor(nvidia.id, null, false, 20, 0)).willReturn(emptyList())
        given(bank.countFor(nvidia.id, null, false)).willReturn(0)

        val page = service.page("nvidia", null, 20, 0)

        assertEquals(0, page.total)
        assertEquals(ArchetypeResolver().resolve("Nvidia").archetype.inProse, page.company.archetypeInProse)
    }

    @Test
    fun `an unknown company is not found, and an unknown round type is refused`() {
        given(directory.bySlug("amazon")).willReturn(amazon)

        assertEquals(HttpStatus.NOT_FOUND, assertThrows<ApiException> { service.page("nobody", null, 20, 0) }.status)
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows<ApiException> { service.page("amazon", "vibes", 20, 0) }.status)
    }

    @Test
    fun `round type counts come back in catalogue order with the unstated last`() {
        given(bank.companiesWithQuestions()).willReturn(
            listOf(CompanyCoverage(amazon, mapOf(null to 1, RoundType.SYSTEM_DESIGN to 2, RoundType.CODING_PRACTICAL to 4))),
        )

        val view = service.companies().single()

        assertEquals(listOf("coding_practical", "system_design", null), view.roundTypes.map { it.roundType })
        assertEquals(7, view.questionCount)
    }
}
