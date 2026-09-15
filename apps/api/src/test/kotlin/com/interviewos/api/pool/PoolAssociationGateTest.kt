package com.interviewos.api.pool

import com.interviewos.api.ai.EmployerKnowledge
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * The gate that decides what a generated question may claim about a real employer.
 *
 * Every one of these is a way a fabricated specific could reach a candidate labelled as
 * fact about their target company, which CLAUDE.md names as the single most damaging
 * failure this product has.
 */
class PoolAssociationGateTest {
    private val company = UUID.fromString("11111111-1111-1111-1111-111111111111")

    private val knows =
        EmployerKnowledge(
            knowsProcess = true,
            basis = "Their loop is widely documented and I am confident about the named rounds.",
            namedRounds = listOf("bar raiser"),
            namedValues = listOf("Customer Obsession"),
        )

    @Test
    fun `a claim backed by a knowledge check that named specifics stands`() {
        val decision =
            PoolAssociationGate.decide(
                companyId = company,
                claimedCompanySpecific = true,
                knowledge = knows,
                vouchingModel = "gemini-3.1-flash-lite",
                writingModel = "gemini-3.1-flash-lite",
            )

        assertThat(decision.association).isEqualTo(Association.COMPANY_SPECIFIC)
        assertThat(decision.knowledgeBasis).isEqualTo(knows.basis)
        assertThat(decision.downgraded).isFalse()
    }

    @Test
    fun `a claim for a company the model said it does not know is withdrawn`() {
        val decision =
            PoolAssociationGate.decide(
                companyId = company,
                claimedCompanySpecific = true,
                knowledge = EmployerKnowledge(knowsProcess = false),
                vouchingModel = "gemini-3.1-flash-lite",
                writingModel = "gemini-3.1-flash-lite",
            )

        assertThat(decision.association).isEqualTo(Association.EMPLOYER_KIND)
        assertThat(decision.downgraded).isTrue()
        assertThat(decision.reason).contains("does not know")
    }

    @Test
    fun `knowing the process but naming nothing does not earn the label`() {
        val decision =
            PoolAssociationGate.decide(
                companyId = company,
                claimedCompanySpecific = true,
                knowledge =
                    EmployerKnowledge(
                        knowsProcess = true,
                        basis = "Yes, I am familiar with how they interview.",
                    ),
                vouchingModel = "gemini-3.1-flash-lite",
                writingModel = "gemini-3.1-flash-lite",
            )

        assertThat(decision.association).isEqualTo(Association.EMPLOYER_KIND)
        assertThat(decision.downgraded).isTrue()
        assertThat(decision.reason).contains("named no round, value or format")
    }

    @Test
    fun `a claim about an employer nobody named is withdrawn`() {
        val decision =
            PoolAssociationGate.decide(
                companyId = null,
                claimedCompanySpecific = true,
                knowledge = knows,
                vouchingModel = "gemini-3.1-flash-lite",
                writingModel = "gemini-3.1-flash-lite",
            )

        assertThat(decision.association).isEqualTo(Association.EMPLOYER_KIND)
        assertThat(decision.downgraded).isTrue()
    }

    @Test
    fun `a claim written by a model other than the one that vouched is withdrawn`() {
        // The chain fell through between the knowledge check and the generation. What the
        // cheap model knows about an employer is not evidence about what the expensive one
        // knows, so the claim goes back to archetype level.
        val decision =
            PoolAssociationGate.decide(
                companyId = company,
                claimedCompanySpecific = true,
                knowledge = knows,
                vouchingModel = "gemini-3.1-flash-lite",
                writingModel = "gemini-3.5-flash",
            )

        assertThat(decision.association).isEqualTo(Association.EMPLOYER_KIND)
        assertThat(decision.downgraded).isTrue()
        assertThat(decision.reason).contains("vouched")
    }

    @Test
    fun `a question that never claimed to be company-specific is not counted as a downgrade`() {
        val decision =
            PoolAssociationGate.decide(
                companyId = company,
                claimedCompanySpecific = false,
                knowledge = knows,
                vouchingModel = "gemini-3.1-flash-lite",
                writingModel = "gemini-3.1-flash-lite",
            )

        assertThat(decision.association).isEqualTo(Association.EMPLOYER_KIND)
        assertThat(decision.downgraded).isFalse()
        assertThat(decision.reason).isNull()
        // The basis is still stored: it is what the model said about the employer, and a
        // reviewer reading the export needs it whichever way the label went.
        assertThat(decision.knowledgeBasis).isEqualTo(knows.basis)
    }

    @Test
    fun `there is no input that promotes a question to company-specific`() {
        // The gate only ever decides downwards. If a question did not claim the label, no
        // amount of knowledge grants it.
        val everything =
            listOf(null, knows, EmployerKnowledge(knowsProcess = true, basis = "x", namedRounds = listOf("y")))
        everything.forEach { knowledge ->
            val decision =
                PoolAssociationGate.decide(
                    companyId = company,
                    claimedCompanySpecific = false,
                    knowledge = knowledge,
                    vouchingModel = "m",
                    writingModel = "m",
                )
            assertThat(decision.association).isEqualTo(Association.EMPLOYER_KIND)
        }
    }
}
