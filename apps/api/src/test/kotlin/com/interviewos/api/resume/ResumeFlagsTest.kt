package com.interviewos.api.resume

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * A warning that fires on everything is not a warning.
 *
 * The reported case: a resume that parsed correctly, shown under "We were not confident
 * reading education.institution. If any of it is wrong, fix it in the document and upload
 * again — a wrong employer changes every round built on it." Nothing was wrong, and the
 * university's name could not have changed a single question.
 */
class ResumeFlagsTest {
    @Test
    fun `drops fields that cannot change the interview`() {
        val shown =
            ResumeFlags.worthShowing(
                listOf("education.institution", "education[0].endYear", "detectedSkills", "headline", "projects[1].name"),
            )

        assertTrue(shown.isEmpty(), "none of these misdirect a round, so none are worth alarming anyone about; got $shown")
    }

    @Test
    fun `keeps the fields a wrong value would ruin a round with`() {
        val fields =
            listOf(
                "employments[0].employer",
                "employments[1].title",
                "employments[0].startDate",
                "employments[2].endDate",
            )

        assertEquals(fields, ResumeFlags.worthShowing(fields))
    }

    /** The one flag that is not a field, and the most important of the lot. */
    @Test
    fun `keeps the flag that says this was not a resume`() {
        assertEquals(listOf("document"), ResumeFlags.worthShowing(listOf("document", "education.institution")))
    }

    @Test
    fun `ignores casing, because the model is not consistent about it`() {
        assertEquals(
            listOf("Employments[0].StartDate"),
            ResumeFlags.worthShowing(listOf("Employments[0].StartDate", "Education.Institution")),
        )
    }

    /**
     * "employments" on its own tells the candidate to go and check everything, which is
     * the same as telling them nothing.
     */
    @Test
    fun `drops a flag too vague to act on`() {
        assertTrue(ResumeFlags.worthShowing(listOf("employments", "employments[0]")).isEmpty())
    }

    @Test
    fun `says each thing once`() {
        assertEquals(
            listOf("employments[0].employer"),
            ResumeFlags.worthShowing(listOf("employments[0].employer", " employments[0].employer ")),
        )
    }

    @Test
    fun `an empty list stays empty`() {
        assertTrue(ResumeFlags.worthShowing(emptyList()).isEmpty())
        assertTrue(ResumeFlags.worthShowing(listOf("", "   ")).isEmpty())
    }
}
