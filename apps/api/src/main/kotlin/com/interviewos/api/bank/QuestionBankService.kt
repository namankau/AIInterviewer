package com.interviewos.api.bank

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ArchetypeResolver
import com.interviewos.api.interview.ProvenanceTier
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * The bank as the versioned API serves it to signed-in candidates.
 *
 * Nothing here is public, deliberately: republishing extracted third-party text on
 * indexable pages is a legal-posture decision for the owner (PRD 16), not a default.
 */
@Service
class QuestionBankService(
    private val directory: CompanyDirectory,
    private val bank: QuestionBankRepository,
    private val archetypes: ArchetypeResolver,
) {
    /** Every company with at least one sourced question. */
    fun companies(): List<BankCompanyView> = bank.companiesWithQuestions().map { companyView(it) }

    /**
     * One company's questions. A company we hold with nothing sourced is an empty page, not
     * a 404 — the page has something true to say about it: its rounds run on general
     * patterns for its archetype.
     */
    fun page(
        slug: String,
        roundType: String?,
        limit: Int,
        offset: Int,
    ): BankQuestionPage {
        val company = directory.bySlug(slug) ?: throw ApiException.notFound("We hold no company by that name.")
        val round =
            roundType?.trim()?.takeIf { it.isNotEmpty() }?.let {
                RoundType.parseOrNull(it) ?: throw ApiException.badRequest("Unknown round type: $it", code = "unknown_round_type")
            }
        val pageSize = limit.coerceIn(1, MAX_LIMIT)
        val from = offset.coerceAtLeast(0)

        return BankQuestionPage(
            company = companyView(bank.coverage(company)),
            roundType = round?.dbValue,
            questions =
                bank
                    .questionsFor(
                        company.id,
                        round,
                        includeUnclassified = false,
                        limit = pageSize,
                        offset = from,
                    ).map { questionView(it) },
            total = bank.countFor(company.id, round, includeUnclassified = false),
            limit = pageSize,
            offset = from,
        )
    }

    private fun companyView(coverage: CompanyCoverage): BankCompanyView {
        val archetype = archetypeOf(coverage.company)
        return BankCompanyView(
            slug = coverage.company.slug,
            name = coverage.company.name,
            archetype = archetype.dbValue,
            archetypeLabel = archetype.label,
            archetypeInProse = archetype.inProse,
            questionCount = coverage.questionCount,
            roundTypes =
                coverage.byRoundType.entries
                    .sortedBy { it.key?.ordinal ?: Int.MAX_VALUE }
                    .map { RoundTypeCountView(roundType = it.key?.dbValue, count = it.value) },
        )
    }

    /**
     * The archetype a round for this company actually runs on: the one decided for it, or
     * else the resolver's — the same answer the room gives, so this page never describes a
     * different loop from the one the candidate will sit.
     */
    private fun archetypeOf(company: Company): Archetype = company.archetype ?: archetypes.resolve(company.name).archetype

    private fun questionView(question: BankQuestion) =
        BankQuestionView(
            id = question.id,
            text = question.text,
            roundType = question.roundType?.dbValue,
            // Every question here was read out of a fetched document; that is the whole
            // entry requirement. The tier is the engine's statement, never the model's.
            tier = ProvenanceTier.PUBLISHED_SOURCE.dbValue,
            corroboration = question.corroboration,
            lastReported = question.lastReported?.toString(),
            companies =
                question.companies.map {
                    CompanyTagView(
                        slug = it.company.slug,
                        name = it.company.name,
                        corroboration = it.corroboration,
                        lastReported = it.lastReported?.toString(),
                    )
                },
            citations =
                question.citations.map {
                    CitationView(title = it.title, publisher = it.publisher, url = it.url, year = it.year, origin = it.origin?.dbValue)
                },
        )

    private companion object {
        const val MAX_LIMIT = 100
    }
}

data class BankCompanyView(
    val slug: String,
    val name: String,
    val archetype: String,
    val archetypeLabel: String,
    /** The archetype mid-sentence, article included: "a global product company loop". */
    val archetypeInProse: String,
    val questionCount: Int,
    /** Round types in catalogue order; a null round type is "the source did not say". */
    val roundTypes: List<RoundTypeCountView>,
)

data class RoundTypeCountView(
    val roundType: String?,
    val count: Int,
)

data class BankQuestionPage(
    val company: BankCompanyView,
    val roundType: String?,
    val questions: List<BankQuestionView>,
    val total: Int,
    val limit: Int,
    val offset: Int,
)

data class BankQuestionView(
    val id: UUID,
    val text: String,
    val roundType: String?,
    /** Always `published_source`: a question enters the bank only from a fetched document. */
    val tier: String,
    /** Distinct sources reporting it, at any company. */
    val corroboration: Int,
    /** ISO date, or null when no source dated it. */
    val lastReported: String?,
    /** Every company it carries, not only the one asked for. */
    val companies: List<CompanyTagView>,
    val citations: List<CitationView>,
)

data class CompanyTagView(
    val slug: String,
    val name: String,
    val corroboration: Int,
    val lastReported: String?,
)

data class CitationView(
    val title: String,
    val publisher: String?,
    val url: String?,
    val year: Int?,
    /** `employer`, `open_licence`, `author`, or null for a source added before origins. */
    val origin: String?,
)
