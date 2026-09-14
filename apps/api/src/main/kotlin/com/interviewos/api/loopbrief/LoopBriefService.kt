package com.interviewos.api.loopbrief

import com.interviewos.api.bank.Company
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.ai.GeneralLoopStage
import com.interviewos.api.bank.CompanyCoverage
import com.interviewos.api.bank.QuestionBankRepository
import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ArchetypeResolver
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Service

/**
 * Before the round: how this company interviews, laid out.
 *
 * The rule that shapes everything here (PRD 04, task 037): what we say about the
 * company comes only from [SourcedStage]s, each backed by a document a candidate can
 * open. What the model contributes is [GeneralLoopPattern] — archetype-level, and
 * composed without ever being told the company's name, so it cannot invent a detail
 * about a company it never saw.
 */
@Service
class LoopBriefService(
    private val directory: CompanyDirectory,
    private val archetypes: ArchetypeResolver,
    private val stages: SourceProcessStageRepository,
    private val patterns: GeneralLoopPatternCache,
    private val bank: QuestionBankRepository,
) {
    fun brief(
        companyName: String,
        role: String?,
        level: String?,
    ): LoopBriefView {
        val cleanedCompany = companyName.trim()
        if (cleanedCompany.isEmpty()) throw ApiException.badRequest("A company is required.", code = "company_required")

        val company = directory.resolve(cleanedCompany)
        val resolution = archetypes.resolve(company?.name ?: cleanedCompany)
        val archetype = company?.archetype ?: resolution.archetype

        val sourcedStages =
            company?.let { SourcedStageMerger.merge(stages.stagesFor(it.id)) }.orEmpty()
        val generalPattern = patterns.patternFor(archetype, role, level)
        val coverage = company?.let { bank.coverage(it) }

        return LoopBriefView(
            company = companyView(company, cleanedCompany, archetype, resolution.confidence.dbValue),
            hasSources = sourcedStages.isNotEmpty(),
            sourcedStages = sourcedStages.map { it.toView() },
            generalPattern = generalPattern.stages.sortedBy { it.order }.map { it.toView() },
            bankCoverage = coverageView(company, coverage),
        )
    }

    private fun companyView(
        company: Company?,
        typedName: String,
        archetype: Archetype,
        confidence: String,
    ) = LoopBriefCompanyView(
        slug = company?.slug,
        name = company?.name ?: typedName,
        archetype = archetype.dbValue,
        archetypeLabel = archetype.label,
        archetypeInProse = archetype.inProse,
        archetypeConfidence = confidence,
    )

    private fun coverageView(
        company: Company?,
        coverage: CompanyCoverage?,
    ) = LoopBriefCoverageView(
        questionCount = coverage?.questionCount ?: 0,
        roundTypes =
            coverage
                ?.byRoundType
                ?.entries
                ?.sortedBy { it.key?.ordinal ?: Int.MAX_VALUE }
                ?.map { LoopBriefRoundCountView(it.key?.dbValue, it.value) }
                .orEmpty(),
        bankUrl = company?.let { "/questions/${it.slug}" },
    )

    private fun SourcedStage.toView() =
        LoopBriefSourcedStageView(
            stageName = stageName,
            roleFamily = roleFamily,
            order = order,
            format = format,
            durationMinutes = durationMinutes,
            assesses = assesses,
            roundType = roundType?.dbValue,
            citations =
                citations.map {
                    LoopBriefCitationView(
                        title = it.title,
                        publisher = it.publisher,
                        url = it.url,
                        year = it.year,
                        origin = it.origin?.dbValue,
                    )
                },
        )

    private fun GeneralLoopStage.toView() =
        LoopBriefGeneralStageView(
            order = order,
            stageName = stageName,
            format = format,
            assesses = assesses,
            roundType = roundType?.let { RoundType.parseOrNull(it) }?.dbValue,
        )
}

data class LoopBriefView(
    val company: LoopBriefCompanyView,
    /** False when we hold no source at all for this company — the honest empty state. */
    val hasSources: Boolean,
    val sourcedStages: List<LoopBriefSourcedStageView>,
    val generalPattern: List<LoopBriefGeneralStageView>,
    val bankCoverage: LoopBriefCoverageView,
)

data class LoopBriefCompanyView(
    /** Null when the company is not one we hold — the brief still renders on the archetype alone. */
    val slug: String?,
    val name: String,
    val archetype: String,
    val archetypeLabel: String,
    val archetypeInProse: String,
    /** `recognised` or `inferred` — see `ArchetypeResolver`. */
    val archetypeConfidence: String,
)

data class LoopBriefSourcedStageView(
    val stageName: String,
    val roleFamily: String?,
    val order: Int?,
    val format: String?,
    val durationMinutes: Int?,
    val assesses: String?,
    val roundType: String?,
    val citations: List<LoopBriefCitationView>,
)

data class LoopBriefGeneralStageView(
    val order: Int,
    val stageName: String,
    val format: String?,
    val assesses: String?,
    val roundType: String?,
)

data class LoopBriefCitationView(
    val title: String,
    val publisher: String?,
    val url: String?,
    val year: Int?,
    val origin: String?,
)

data class LoopBriefCoverageView(
    val questionCount: Int,
    val roundTypes: List<LoopBriefRoundCountView>,
    /** Link to `/questions/<slug>`, null when we hold no company. */
    val bankUrl: String?,
)

data class LoopBriefRoundCountView(
    val roundType: String?,
    val count: Int,
)
