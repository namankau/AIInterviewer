package com.interviewos.api.loopbrief

import com.interviewos.api.interview.ReadinessGroup
import com.interviewos.api.interview.ReadinessService
import com.interviewos.api.interview.RoundType
import com.interviewos.api.interview.RoundsProperties
import com.interviewos.api.resume.CandidateBackground
import com.interviewos.api.resume.ResumeService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * The plan: an ordered list of practice rounds, computed on request from the loop brief,
 * the candidate's resume, and their own past sessions against this exact company and
 * role. Never persisted — there is no target entity to store it against, and none is
 * created here (PRD 05, `CLAUDE.md`).
 *
 * The ordering and round-type filtering are deterministic ([PrepPlanBuilder]), not a
 * model's to get wrong on a given request. Personalisation — tying an item to the
 * candidate's own resume or past reports — is best-effort: a failure reading either
 * degrades to the plan without it, rather than failing the whole page.
 */
@Service
class PrepPlanService(
    private val loopBrief: LoopBriefService,
    private val resumeService: ResumeService,
    private val readinessService: ReadinessService,
    private val rounds: RoundsProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun plan(
        userId: UUID,
        companyName: String,
        role: String?,
        level: String?,
    ): PrepPlanView {
        val resolved = loopBrief.resolveLoop(companyName, role, level)
        val inputs = stageInputsFor(resolved)
        val build = PrepPlanBuilder.build(rounds.offeredTypes, inputs)

        val background = safeBackground(userId)
        val history = role?.let { safeHistory(userId, resolved.company?.name ?: resolved.typedName, it) }

        return PrepPlanView(
            items = build.items.map { it.toView(resolved, background, history) },
            unsimulatedStages = build.unsimulatedStages.map { PrepPlanUnsimulatedView(it.stageName, it.note) },
        )
    }

    private fun stageInputsFor(resolved: ResolvedLoop): List<PlanStageInput> =
        if (resolved.sourcedStages.isNotEmpty()) {
            resolved.sourcedStages.map {
                PlanStageInput(it.order, it.stageName, it.assesses, it.roundType, it.citations)
            }
        } else {
            resolved.generalPattern.map {
                PlanStageInput(it.order, it.stageName, it.assesses, it.roundType?.let(RoundType::parseOrNull))
            }
        }

    private fun safeBackground(userId: UUID): CandidateBackground? =
        try {
            resumeService.backgroundFor(userId)
        } catch (e: RuntimeException) {
            log.warn("Could not read resume background for {}; the plan will run without it", userId, e)
            null
        }

    private fun safeHistory(
        userId: UUID,
        companyName: String,
        roleTitle: String,
    ): ReadinessGroup? =
        try {
            readinessService.readinessFor(userId, companyName, roleTitle)
        } catch (e: RuntimeException) {
            log.warn("Could not read session history for {} at {}/{}; the plan will run without it", userId, companyName, roleTitle, e)
            null
        }

    private fun PlanItem.toView(
        resolved: ResolvedLoop,
        background: CandidateBackground?,
        history: ReadinessGroup?,
    ): PrepPlanItemView {
        val companyLabel = resolved.company?.name ?: resolved.typedName
        val why =
            buildString {
                append(
                    if (isSourced) {
                        "This is how $companyLabel's own \"$stageName\" stage runs, from a source we've read."
                    } else {
                        "Typical of ${resolved.archetype.inProse}: a \"$stageName\" stage."
                    },
                )
                personalNote(roundType, background, history)?.let { append(' '); append(it) }
            }

        return PrepPlanItemView(
            roundType = roundType.dbValue,
            roundLabel = roundType.label,
            stageName = stageName,
            why = why,
            focusAreas = focusAreas,
            suggestedMinutes = suggestedMinutes,
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
    }

    /**
     * A sentence tying this round to something the candidate's own resume or past
     * reports actually say — never a general observation dressed up as personal.
     */
    private fun personalNote(
        roundType: RoundType,
        background: CandidateBackground?,
        history: ReadinessGroup?,
    ): String? {
        if (roundType == RoundType.PROJECT_DEEP_DIVE) {
            background?.resume?.employments?.firstOrNull()?.let {
                return "You can walk through your time at ${it.employer}."
            }
        }
        history?.recurringWeaknesses?.firstOrNull()?.let {
            return "Your past reports here have flagged \"$it\" more than once — worth targeting."
        }
        return null
    }
}

data class PrepPlanView(
    val items: List<PrepPlanItemView>,
    val unsimulatedStages: List<PrepPlanUnsimulatedView>,
)

data class PrepPlanItemView(
    val roundType: String,
    val roundLabel: String,
    val stageName: String,
    val why: String,
    val focusAreas: List<String>,
    val suggestedMinutes: Int,
    /** Empty unless this round is tied to a stage a fetched source actually reports. */
    val citations: List<LoopBriefCitationView>,
)

data class PrepPlanUnsimulatedView(
    val stageName: String,
    val note: String,
)
