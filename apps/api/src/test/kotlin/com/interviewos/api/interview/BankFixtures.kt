package com.interviewos.api.interview

import com.interviewos.api.bank.BankCitation
import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.bank.Company
import com.interviewos.api.bank.CompanyTag
import com.interviewos.api.bank.SourceOrigin
import java.time.LocalDate
import java.util.UUID

/** Bank questions for tests, backed the way the repository returns them. */
object BankFixtures {
    val amazon = Company(UUID.fromString("00000000-0000-0000-0000-00000000a111"), "amazon", "Amazon", emptyList(), null)

    fun question(
        text: String,
        company: Company = amazon,
        corroboration: Int = 1,
        lastReported: LocalDate? = LocalDate.of(2026, 1, 1),
        roundType: RoundType? = RoundType.BEHAVIOURAL_COMPETENCY,
        id: UUID = UUID.nameUUIDFromBytes(text.toByteArray()),
    ): BankQuestion {
        val citations =
            (1..corroboration).map { n ->
                BankCitation(
                    sourceId = UUID.nameUUIDFromBytes("$text-source-$n".toByteArray()),
                    title = "Report $n of \"$text\"",
                    publisher = "Publisher $n",
                    url = "https://example.org/${id.toString().take(8)}/$n",
                    year = 2026,
                    origin = SourceOrigin.AUTHOR,
                )
            }
        return BankQuestion(
            id = id,
            text = text,
            roundType = roundType,
            companies = listOf(CompanyTag(company, corroboration, lastReported)),
            citations = citations,
            corroboration = corroboration,
            lastReported = lastReported,
            notes = null,
        )
    }
}
