package com.interviewos.api.resume

import com.interviewos.api.ai.ParsedEmployment
import com.interviewos.api.ai.ParsedProject
import com.interviewos.api.ai.ParsedResume
import org.junit.jupiter.api.Test
import java.time.LocalDate
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * What the interviewer is told about the candidate.
 *
 * This is the text that turns a generic project deep-dive into one about the settlement
 * pipeline they actually built, so what it does and does not say matters. The risks are
 * specific: an interviewer that asserts a mis-parsed employer back at somebody loses them
 * immediately, and one that opens a system design round by asking about a career gap is
 * being rude rather than thorough.
 */
class CandidateBackgroundTest {
    private fun background(
        projects: List<ParsedProject> = emptyList(),
        employments: List<ParsedEmployment> = emptyList(),
        skills: List<String> = emptyList(),
        lowConfidence: List<String> = emptyList(),
        headline: String? = "Senior backend engineer, payments",
    ): CandidateBackground {
        val resume =
            ParsedResume(
                fullName = "Priya Sharma",
                headline = headline,
                employments = employments,
                projects = projects,
                education = emptyList(),
                certifications = emptyList(),
                detectedSkills = skills,
                lowConfidenceFields = lowConfidence,
            )
        return CandidateBackground(resume, ResumeTimeline.summarise(employments, LocalDate.parse("2026-09-08")))
    }

    @Test
    fun `names the projects, because they are the strongest thing to ask about`() {
        val prompt =
            background(
                projects =
                    listOf(
                        ParsedProject(
                            name = "Append-only settlement ledger",
                            description = "Replaced in-place balance mutation with an immutable ledger.",
                            technologies = listOf("Kotlin", "PostgreSQL"),
                            domain = "payments",
                        ),
                    ),
            ).asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.contains("Append-only settlement ledger"))
        assertTrue(prompt.contains("Kotlin"))
    }

    @Test
    fun `states experience as derived rather than as something the resume claimed`() {
        val prompt =
            background(
                employments =
                    listOf(
                        ParsedEmployment("Razorpay", "Senior Engineer", null, LocalDate.parse("2022-03-01"), null, true),
                        ParsedEmployment(
                            "Infosys",
                            "Engineer",
                            null,
                            LocalDate.parse("2019-07-01"),
                            LocalDate.parse("2022-02-01"),
                            false,
                        ),
                    ),
            ).asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.contains("computed by us, not claimed by the resume"))
        assertTrue(prompt.contains("7 years"), "2019-07 to 2026-09 is about seven years")
    }

    /**
     * The instruction that stops the interviewer stating a parse back as fact. A model
     * handed an employment history will otherwise open with "so you were at Acme for two
     * years", and a mis-read date becomes it contradicting the candidate about their own
     * career.
     */
    @Test
    fun `tells the interviewer to ask rather than assert`() {
        val prompt = background().asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.contains("Ask them to tell you about it rather than asserting it back"))
        assertTrue(prompt.contains("may be wrong"))
    }

    @Test
    fun `passes on what the parser was unsure of, and says not to state it as fact`() {
        val prompt = background(lowConfidence = listOf("employments[1].title")).asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.contains("employments[1].title"))
        assertTrue(prompt.contains("Do not state them back as fact"))
    }

    @Test
    fun `says nothing about uncertainty when the parse was clean`() {
        assertFalse(background().asPrompt(ResumeUse.SYLLABUS).contains("We were unsure"))
    }

    /**
     * Gaps are fair game in an HR round and out of place in a system design one, so the
     * prompt hands over the fact and the judgement together rather than the fact alone.
     */
    @Test
    fun `guards how career gaps may be used`() {
        val prompt =
            background(
                employments =
                    listOf(
                        ParsedEmployment("Acme", "Engineer", null, LocalDate.parse("2020-01-01"), LocalDate.parse("2021-01-01"), false),
                        ParsedEmployment("Globex", "Engineer", null, LocalDate.parse("2021-10-01"), LocalDate.parse("2023-01-01"), false),
                    ),
            ).asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.contains("gap(s) between roles"))
        assertTrue(prompt.contains("Do not raise gaps or short stints unless the round type makes that appropriate"))
    }

    /**
     * The bug this exists for. Roles reached the model in whatever order the PDF happened
     * to be laid out in, with nothing saying which one was current — so it picked whichever
     * looked most interesting and interviewed a candidate about a job they left in 2022.
     */
    @Test
    fun `puts the current role first and says that it is the current one`() {
        val prompt =
            background(
                employments =
                    listOf(
                        ParsedEmployment(
                            "Infosys",
                            "Engineer",
                            null,
                            LocalDate.parse("2019-07-01"),
                            LocalDate.parse("2022-02-01"),
                            false,
                        ),
                        ParsedEmployment("Razorpay", "Senior Engineer", null, LocalDate.parse("2022-03-01"), null, true),
                    ),
            ).asPrompt(ResumeUse.SYLLABUS)

        val razorpay = prompt.indexOf("Razorpay")
        val infosys = prompt.indexOf("Infosys")
        assertTrue(razorpay in 0..<infosys, "the current role has to come first, was Infosys then Razorpay")
        assertTrue(
            prompt.lineSequence().first { it.contains("Razorpay") }.contains("most recent"),
            "sorting alone is not enough — a bare list gives the model no reason to think the order means anything",
        )
        assertTrue(prompt.contains("Anchor on the role at the top of the list"))
    }

    /**
     * The complaint this whole distinction exists for.
     *
     * The guidance above — dig into their projects, anchor on the current role — was
     * written to fix a real bug and was then applied to every round alike. The result was
     * that a system design round spent itself touring the candidate's last project
     * instead of the case on their screen. What the CV is *for* now depends on the round.
     */
    @Test
    fun `a round whose subject is not the CV is told so`() {
        val employments =
            listOf(ParsedEmployment("Razorpay", "Senior Engineer", null, LocalDate.parse("2022-03-01"), null, true))

        val deepDive = background(employments = employments).asPrompt(ResumeUse.SYLLABUS)
        val design = background(employments = employments).asPrompt(ResumeUse.CONTEXT)

        assertTrue(deepDive.contains("This round is about this work"))
        assertTrue(design.contains("This round is not about their CV"))
        assertFalse(
            design.contains("Anchor on the role at the top of the list"),
            "anchoring on the current role is right for a deep-dive and wrong for a design round",
        )
    }

    /** Whatever the round, the CV is still described as parsed and possibly wrong. */
    @Test
    fun `every round is warned the parse may be wrong`() {
        for (use in ResumeUse.entries) {
            val prompt = background().asPrompt(use)

            assertTrue(prompt.contains("may be wrong"), "$use must not assert a parsed CV as fact")
            assertTrue(prompt.contains("Ask them to tell you about it rather than asserting it back"))
        }
    }

    /** Two finished roles and no current one: the one that ended last is still the recent one. */
    @Test
    fun `orders finished roles by when they ended`() {
        val prompt =
            background(
                employments =
                    listOf(
                        ParsedEmployment("Acme", "Engineer", null, LocalDate.parse("2018-01-01"), LocalDate.parse("2020-01-01"), false),
                        ParsedEmployment("Globex", "Engineer", null, LocalDate.parse("2020-02-01"), LocalDate.parse("2024-06-01"), false),
                    ),
            ).asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.indexOf("Globex") < prompt.indexOf("Acme"))
    }

    /**
     * An undated role sorts last. An unknown date is not evidence of recency, and letting
     * one float to the top would put the bug straight back.
     */
    @Test
    fun `a role with no dates does not displace a dated current one`() {
        val prompt =
            background(
                employments =
                    listOf(
                        ParsedEmployment("Mystery Corp", "Consultant", null, null, null, false),
                        ParsedEmployment("Razorpay", "Senior Engineer", null, LocalDate.parse("2022-03-01"), null, true),
                    ),
            ).asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.indexOf("Razorpay") < prompt.indexOf("Mystery Corp"))
    }

    @Test
    fun `an empty resume still produces something usable rather than failing`() {
        val prompt = background(headline = null).asPrompt(ResumeUse.SYLLABUS)

        assertTrue(prompt.isNotBlank())
        assertFalse(prompt.contains("Projects they list"))
    }
}
