package com.interviewos.api.bank

import com.interviewos.api.interview.ProvenanceSource
import com.interviewos.api.interview.RoundType
import java.time.LocalDate
import java.util.UUID

/**
 * A question in the bank, with everything that backs it.
 *
 * Every field that makes a claim is derived from reports by fetched sources: [companies]
 * are the employers some source says asked it, [citations] are those sources, and the two
 * counts are over them. There is no way to build one of these that is not backed.
 */
data class BankQuestion(
    val id: UUID,
    /** The wording of the first report. */
    val text: String,
    val roundType: RoundType?,
    /** Every employer it is reported at — all of them, whichever company was asked for. */
    val companies: List<CompanyTag>,
    val citations: List<BankCitation>,
    /** Distinct fetched sources reporting it, at any company. */
    val corroboration: Int,
    /** Latest date a source says it was asked; failing that, latest publication date. */
    val lastReported: LocalDate?,
    /** One line from a source on what it was testing. Null when no source said. */
    val notes: String?,
) {
    /** The tag for one company, when the question carries it. */
    fun tagFor(companyId: UUID): CompanyTag? = companies.firstOrNull { it.company.id == companyId }
}

/** Question Q is reported at [company] by [corroboration] fetched sources. */
data class CompanyTag(
    val company: Company,
    val corroboration: Int,
    val lastReported: LocalDate?,
)

/** A fetched source that reports a question, and the basis on which we may use it. */
data class BankCitation(
    val sourceId: UUID,
    val title: String,
    val publisher: String?,
    val url: String?,
    val year: Int?,
    /** Null for sources added before origins were recorded. */
    val origin: SourceOrigin?,
) {
    /** As a round's provenance records it (`QuestionProvenance.sources`). */
    fun toProvenanceSource(): ProvenanceSource = ProvenanceSource(title = title, publisher = publisher, url = url, year = year)
}

/** How many sourced questions a company has, per round type. A null key is "round not stated". */
data class CompanyCoverage(
    val company: Company,
    val byRoundType: Map<RoundType?, Int>,
) {
    val questionCount: Int get() = byRoundType.values.sum()
}
