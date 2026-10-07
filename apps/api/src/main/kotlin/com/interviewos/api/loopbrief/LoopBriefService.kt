package com.interviewos.api.loopbrief

import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.GeneralLoopStage
import com.interviewos.api.ai.GroundedEmployerLoop
import com.interviewos.api.bank.Company
import com.interviewos.api.bank.CompanyCoverage
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.bank.QuestionBankProperties
import com.interviewos.api.bank.QuestionBankRepository
import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ArchetypeResolver
import com.interviewos.api.interview.Confidence
import com.interviewos.api.interview.RoundType
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

/**
 * Before the round: how this company interviews, laid out.
 *
 * The rule that shapes everything here (PRD 04, task 037): what we say about the
 * company comes only from [SourcedStage]s, each backed by a document a candidate can
 * open. What the model contributes is [GeneralLoopPattern] — archetype-level, and
 * composed without ever being told the company's name, so it cannot invent a detail
 * about a company it never saw.
 *
 * Between the two sits [PublicLoopResearch], for a company with no sourced stage at
 * all: what public pages say, sentence by sentence, each sentence linked to the pages
 * behind it. It is asked only when the library has nothing, and it is shown as its own
 * labelled section — never merged into either of the others.
 *
 * Beside the search, [ModelEmployerKnowledge] says what the model itself can name about
 * the employer, shown as the model's knowledge. The prep plan is built from its named
 * rounds, so it is shown whenever it exists. Only when both are empty does the brief
 * stand on the archetype pattern alone.
 */
@Service
class LoopBriefService(
    private val directory: CompanyDirectory,
    private val archetypes: ArchetypeResolver,
    private val stages: SourceProcessStageRepository,
    private val patterns: GeneralLoopPatternCache,
    private val bank: QuestionBankRepository,
    private val bankBrowsing: QuestionBankProperties,
    private val publicResearch: PublicLoopResearch,
    private val modelKnowledge: ModelEmployerKnowledge,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun brief(
        companyName: String,
        role: String?,
        level: String?,
    ): LoopBriefView {
        val resolved = resolveLoop(companyName, role, level)
        val coverage = resolved.company?.let { bank.coverage(it) }
        // Our own sourced record outranks a web search, so the search is not paid for
        // when we have one.
        val companyName = resolved.company?.name ?: resolved.typedName
        val publicPattern =
            if (resolved.sourcedStages.isEmpty()) {
                publicResearch.patternFor(companyName, role, level)
            } else {
                null
            }

        return LoopBriefView(
            company =
                companyView(resolved.company, resolved.typedName, resolved.archetype, resolved.confidence.dbValue),
            hasSources = resolved.sourcedStages.isNotEmpty(),
            sourcedStages = resolved.sourcedStages.map { it.toView() },
            generalPattern = resolved.generalPattern.sortedBy { it.order }.map { it.toView() },
            campusPattern = resolved.campus,
            publicSourcePattern = publicPattern?.toView(),
            modelKnowledge = resolved.modelKnowledge?.toView(),
            bankCoverage = coverageView(resolved.company, coverage),
        )
    }

    /**
     * The domain-level loop a candidate typed in, resolved once and shared by the brief
     * and the prep plan so the two can never disagree about which stages exist.
     */
    fun resolveLoop(
        companyName: String,
        role: String?,
        level: String?,
    ): ResolvedLoop {
        val cleanedCompany = companyName.trim()
        if (cleanedCompany.isEmpty()) throw ApiException.badRequest("A company is required.", code = "company_required")

        val company = directory.resolve(cleanedCompany)
        val resolution = archetypes.resolve(company?.name ?: cleanedCompany)
        val archetype = company?.archetype ?: resolution.archetype

        val sourcedStages = company?.let { SourcedStageMerger.merge(stages.stagesFor(it.id)) }.orEmpty()
        val generalPattern = patterns.patternFor(archetype, role, level).stages
        // Asked whenever we hold no sourced stage, beside any web search, because the plan
        // is built from it: the brief has to show what the plan stands on.
        val knowledge =
            if (sourcedStages.isEmpty()) modelKnowledge.knowledgeOf(company?.name ?: cleanedCompany, archetype.label) else null

        // What the brief stood on. `model_knowledge_asked` is the billed path, so this is
        // also how often an unknown employer costs a model call.
        log
            .atInfo()
            .addKeyValue("company_recognised", company != null)
            .addKeyValue("archetype", archetype.name.lowercase())
            .addKeyValue("sourced_stages", sourcedStages.size)
            .addKeyValue("model_knowledge_asked", sourcedStages.isEmpty())
            .log("Loop resolved")

        return ResolvedLoop(
            company = company,
            typedName = cleanedCompany,
            archetype = archetype,
            confidence = resolution.confidence,
            sourcedStages = sourcedStages,
            generalPattern = generalPattern,
            modelKnowledge = knowledge,
            campus = CampusLoopPattern.isCampus(level),
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
        // No link to a page that answers 404: null while the bank is not browsable (task 042).
        bankUrl = company?.takeIf { bankBrowsing.browsable }?.let { "/questions/${it.slug}" },
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

    private fun GroundedEmployerLoop.toView() =
        LoopBriefPublicPatternView(
            claims = claims.map { LoopBriefPublicClaimView(text = it.text, sourceIndexes = it.sourceIndexes) },
            sources = sources.map { LoopBriefPublicSourceView(title = it.title, url = it.url) },
        )

    private fun EmployerKnowledge.toView() =
        LoopBriefModelKnowledgeView(
            basis = basis,
            namedRounds = namedRounds,
            namedValues = namedValues,
            namedFormats = namedFormats,
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

/** The resolved loop, before it is shaped into either the brief's or the plan's view. */
data class ResolvedLoop(
    val company: Company?,
    /** What the candidate typed, used when [company] is null — we hold no such employer. */
    val typedName: String,
    val archetype: Archetype,
    val confidence: Confidence,
    val sourcedStages: List<SourcedStage>,
    val generalPattern: List<GeneralLoopStage>,
    /** What the model can name about this employer; null whenever [sourcedStages] is not empty. */
    val modelKnowledge: EmployerKnowledge? = null,
    /** True when the candidate stated they are a student or recent graduate, so [generalPattern] is the campus loop. */
    val campus: Boolean = false,
)

data class LoopBriefView(
    val company: LoopBriefCompanyView,
    /** False when we hold no source at all for this company — the honest empty state. */
    val hasSources: Boolean,
    val sourcedStages: List<LoopBriefSourcedStageView>,
    val generalPattern: List<LoopBriefGeneralStageView>,
    /** True when [generalPattern] is the campus-hiring pattern, asked for by a stated student or graduate stage. */
    val campusPattern: Boolean = false,
    /**
     * What public pages say about this employer, when we hold no sourced stage for it and
     * a search found something citable. Null otherwise — including whenever [hasSources].
     */
    val publicSourcePattern: LoopBriefPublicPatternView? = null,
    /**
     * What the model itself can name about this employer's process, when we hold no
     * sourced stage. Null otherwise. The `model_knowledge` tier: no
     * page stands behind it, and the client must say so.
     */
    val modelKnowledge: LoopBriefModelKnowledgeView? = null,
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

data class LoopBriefPublicPatternView(
    val claims: List<LoopBriefPublicClaimView>,
    val sources: List<LoopBriefPublicSourceView>,
)

data class LoopBriefModelKnowledgeView(
    /** The model's own account of what it knows and how dated it may be. */
    val basis: String?,
    val namedRounds: List<String>,
    val namedValues: List<String>,
    val namedFormats: List<String>,
)

data class LoopBriefPublicClaimView(
    val text: String,
    /** Zero-based indexes into [LoopBriefPublicPatternView.sources]; never empty. */
    val sourceIndexes: List<Int>,
)

data class LoopBriefPublicSourceView(
    val title: String,
    val url: String,
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
