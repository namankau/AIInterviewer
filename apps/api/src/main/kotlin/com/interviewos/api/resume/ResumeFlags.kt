package com.interviewos.api.resume

/**
 * Which parse uncertainties are worth putting in front of the candidate.
 *
 * `lowConfidenceFields` exists for one purpose: a wrong employer, title or date silently
 * degrades every round built on the resume, so the candidate gets a chance to correct it
 * before that happens. It is a warning, and a warning that fires on everything is not one.
 *
 * The prompt says all of this at length and the model flags things anyway — most often
 * `education.institution`, which cannot misdirect an interview at all. Nobody's mock round
 * gets worse because we were unsure whether a university's name had an ampersand in it,
 * and a candidate told "we were not confident reading education.institution" above a
 * correctly-parsed resume learns only that the tool is nervous.
 *
 * So the list is filtered here rather than asked for politely. This is the same shape as
 * [com.interviewos.api.interview.QuestionText]: where three rounds of prompt changes have
 * not moved a behaviour, the prompt is not the place to keep trying.
 */
object ResumeFlags {
    /**
     * [fields] reduced to the ones a candidate should act on, in the order given and
     * without duplicates.
     */
    fun worthShowing(fields: List<String>): List<String> =
        fields
            .map { it.trim() }
            .filter { it.isNotEmpty() && matters(it) }
            .distinct()

    private fun matters(field: String): Boolean {
        val normalised = field.lowercase()
        if (normalised == DOCUMENT) return true
        if (!normalised.startsWith("employments")) return false
        // A bare "employments" says nothing actionable; the point is naming which field of
        // which role to look at.
        return WORTH_CORRECTING.any { normalised.endsWith(it) }
    }

    /**
     * The file was not a resume. Not a field at all, and the one flag that matters more
     * than any of the others — everything downstream is built on the assumption it was.
     */
    private const val DOCUMENT = "document"

    /**
     * Change any of these and the interview changes: which employer's process is being
     * simulated, what seniority the questions are pitched at, and how much experience the
     * candidate is credited with. Nothing else on a resume has that reach.
     */
    private val WORTH_CORRECTING = listOf(".employer", ".title", ".startdate", ".enddate", ".current")
}
