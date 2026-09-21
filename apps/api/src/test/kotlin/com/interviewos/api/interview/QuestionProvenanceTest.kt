package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The report tells candidates where their questions came from. That is only worth
 * anything if it cannot quietly overstate itself, so these are the tests that guard the
 * overstatement rather than the happy path.
 */
class QuestionProvenanceTest {
    @Test
    fun `a question the model wrote is labelled as the model's own knowledge`() {
        val provenance =
            assertNotNull(
                QuestionProvenance.fromModel(
                    basis = "Global product system-design rounds push on consistency trade-offs.",
                    probes = "Whether they can defend an asynchronous projection.",
                    askedBecause = "You called the projection 'mostly fine' without naming a failure mode.",
                ),
            )

        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, provenance.tier)
    }

    /**
     * The rule the whole feature rests on. There is no retrieval corpus, so there is
     * nothing to cite, and a citation the candidate can check and fail to find would cost
     * more trust than the section buys.
     */
    @Test
    fun `nothing is ever cited, because nothing has been retrieved`() {
        val provenance =
            assertNotNull(
                QuestionProvenance.fromModel(
                    basis = "Consulting case rounds open on market sizing.",
                    probes = "Structured estimation.",
                    askedBecause = "You said you had not done a case round before.",
                ),
            )

        assertTrue(provenance.sources.isEmpty())
    }

    @Test
    fun `the disclosure says plainly that this is not a report of the company's questions`() {
        val disclosure = ProvenanceTier.MODEL_KNOWLEDGE.disclosure

        assertTrue(disclosure.contains("not a report"), "the candidate must not be left to infer it")
    }

    @Test
    fun `a question the model said nothing about carries no provenance at all`() {
        // Absent is honest. An empty record renders as a section with nothing in it, which
        // reads like a citation that failed to load rather than one that was never made.
        assertNull(QuestionProvenance.fromModel(null, null, null))
        assertNull(QuestionProvenance.fromModel("", "   ", null))
    }

    @Test
    fun `partial reasoning is kept rather than discarded`() {
        val provenance = assertNotNull(QuestionProvenance.fromModel(null, "Capacity estimation.", null))

        assertEquals("Capacity estimation.", provenance.probes)
        assertEquals("", provenance.basis)
        assertTrue(provenance.sources.isEmpty())
    }

    @Test
    fun `an unknown tier from the database degrades to the weakest claim`() {
        // Never to the strongest. If a row is unreadable the right failure is to
        // under-claim, not to promote a question to `published_source`.
        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, ProvenanceTier.fromDbValue("something_new"))
        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, ProvenanceTier.fromDbValue(null))
    }

    @Test
    fun `a bank question cites its own sources and nobody else's`() {
        val asked = BankFixtures.question("Tell me about a time you disagreed with your manager.", corroboration = 2)
        BankFixtures.question("Tell me about a time you failed.", corroboration = 3)

        val provenance = assertNotNull(QuestionProvenance.fromBank(asked, "Amazon", probes = null, askedBecause = null))

        assertEquals(ProvenanceTier.PUBLISHED_SOURCE, provenance.tier)
        assertEquals(asked.citations.map { it.url }, provenance.sources.map { it.url })
        assertEquals("Reported for Amazon by 2 sources we hold, cited below.", provenance.basis)
        assertTrue(provenance.askedBecause.isNotBlank(), "a replaced question still says why it was asked")
    }

    /**
     * The rule task 048 turns on.
     *
     * A campus process is the thing a model will state most confidently and the thing we
     * can least support: the employers' own pages could not be read, and every figure in
     * circulation about their tests comes from prep aggregators. So a claim about how
     * campus hiring runs, written by the model, stays `model_knowledge` however specific
     * it sounds — and an empty citation list cannot promote it.
     */
    @Test
    fun `a campus process claim with no source behind it is never published_source`() {
        val claim =
            "Campus hiring at this kind of employer typically opens with an aptitude and reasoning gate " +
                "before any technical round."

        val fromModel = assertNotNull(QuestionProvenance.fromModel(claim, "Reasoning under time pressure.", "You are a fresher."))
        val fromNoSources = assertNotNull(QuestionProvenance.fromSources(claim, "Reasoning.", "You are a fresher.", sources = emptyList()))

        for (provenance in listOf(fromModel, fromNoSources)) {
            assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, provenance.tier)
            assertTrue(provenance.sources.isEmpty())
        }
    }

    /**
     * An aptitude question comes out of the pool, and the pool is the model's own writing.
     * Nothing about the round type can raise it, and what the candidate reads says so in
     * as many words.
     */
    @Test
    fun `an aptitude question from the pool is the model's own knowledge, and says so`() {
        val label = PoolQuestionLabel.employerKind(Archetype.SERVICE_BASED_IT)

        val provenance = QuestionProvenance.fromPool(label, probes = "Ratios worked aloud.", askedBecause = null)

        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, provenance.tier)
        assertTrue(provenance.sources.isEmpty())
        assertEquals(label, provenance.label)
        assertTrue(label.contains("Not a verified report"), "the candidate is told, not left to infer it")
    }
}
