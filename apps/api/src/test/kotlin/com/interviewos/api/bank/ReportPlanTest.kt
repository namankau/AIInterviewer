package com.interviewos.api.bank

import com.interviewos.api.ai.ExtractedQuestion
import com.interviewos.api.interview.RoundType
import org.junit.jupiter.api.Test
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Which company an extracted question is filed under — the claim a tag makes. */
class ReportPlanTest {
    @Test
    fun `a question reported at two employers carries both`() {
        val plan = ReportPlan.plan(listOf(ExtractedQuestion("Design a rate limiter", companies = listOf("Amazon", "Microsoft"))), "Amazon")

        assertEquals(listOf("Amazon", "Microsoft"), plan.single().companies)
    }

    @Test
    fun `a question naming no employer takes the source's declared company`() {
        val plan = ReportPlan.plan(listOf(ExtractedQuestion("Why this team?")), "Google")

        assertEquals(listOf("Google"), plan.single().companies)
    }

    @Test
    fun `the declared company is not added when the text names an employer`() {
        val plan = ReportPlan.plan(listOf(ExtractedQuestion("Why this team?", companies = listOf("Meta"))), "Google")

        assertEquals(listOf("Meta"), plan.single().companies)
    }

    @Test
    fun `a group is dropped, never filed as a company`() {
        val plan = ReportPlan.plan(listOf(ExtractedQuestion("Two sum", companies = listOf("FAANG", "Big Tech"))), null)

        assertTrue(plan.single().companies.isEmpty(), "an untagged report, not a company called FAANG")
    }

    @Test
    fun `a group-only mention falls back to the declared company like any unnamed one`() {
        val plan = ReportPlan.plan(listOf(ExtractedQuestion("Two sum", companies = listOf("FAANG"))), "Stripe")

        assertEquals(listOf("Stripe"), plan.single().companies)
    }

    @Test
    fun `one source repeating a question is one question with both mentions' companies`() {
        val plan =
            ReportPlan.plan(
                listOf(
                    ExtractedQuestion("Reverse a linked list.", companies = listOf("Amazon"), askedOn = LocalDate.of(2023, 1, 1)),
                    ExtractedQuestion("reverse a linked list", companies = listOf("amazon", "Uber"), roundType = "coding_practical"),
                ),
                null,
            )

        val question = plan.single()
        assertEquals("Reverse a linked list.", question.text)
        assertEquals(listOf("Amazon", "Uber"), question.companies)
        assertEquals(RoundType.CODING_PRACTICAL, question.roundType)
        assertEquals(LocalDate.of(2023, 1, 1), question.askedOn)
    }

    @Test
    fun `punctuation is not a question, and an unknown round type is no round type`() {
        val plan = ReportPlan.plan(listOf(ExtractedQuestion("?!"), ExtractedQuestion("Why us?", roundType = "vibes")), null)

        assertEquals(1, plan.size)
        assertNull(plan.single().roundType)
    }
}
