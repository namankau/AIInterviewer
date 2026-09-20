package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component

/**
 * Technical fundamentals, task 041 (PRD §08, §09).
 *
 * "Fundamentals" is not one question set with seven labels on it — a backend candidate and
 * an ML candidate do not share a syllabus, and a question that is fair for both ends up
 * being specific to neither. [roleFamilyFocus] is what stops that: it names the ground each
 * [RoleFamily] is actually examined on, and the prompt is told to stay inside it.
 *
 * Depth follows [Level] the same way — `entry` gets "what and why", `staff` gets trade-offs
 * and the failure modes underneath the concept — via [levelDepth], read into the same
 * guidance block rather than left for the model to calibrate on its own.
 */
@Component
class TechnicalFundamentalsQuestionGenerator(
    private val ai: InterviewAi,
) : QuestionGenerator {
    override val roundType: RoundType = RoundType.TECHNICAL_FUNDAMENTALS

    // Bumped for task 048: entry level is now examined on the degree syllabus rather than
    // on a role family's production concerns, so its questions are not comparable with
    // what version 1 wrote.
    override val version: Int = 2

    override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> =
        ai.generatePoolQuestions(
            PoolQuestionRequest(
                companyName = request.cell.companyName,
                archetype = request.cell.coordinate.archetype.label,
                roundType = roundType.label,
                roleFamily = request.cell.coordinate.roleFamily.label,
                level = request.cell.coordinate.level.label,
                roundGuidance = guidance(request.cell.coordinate.roleFamily, request.cell.coordinate.level),
                count = request.count,
                avoid = request.avoid,
                knowledge = request.knowledge,
            ),
        )

    private fun guidance(
        roleFamily: RoleFamily,
        level: Level,
    ): String =
        buildString {
            append(roundType.brief)
            append("\n\nGround this round has to get across:\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            append("\n\nThis slot is ${roleFamily.label}. Stay inside that family's own fundamentals:\n")
            append(roleFamilyFocus(roleFamily))
            append("\n\n")
            append(levelDepth(level))
        }

    /**
     * What "fundamentals" means for one role family. Concrete enough that a question
     * written against it could not be mistaken for a different family's question.
     */
    private fun roleFamilyFocus(roleFamily: RoleFamily): String =
        when (roleFamily) {
            RoleFamily.BACKEND -> {
                "API design and contracts, data modelling and normalisation, transactions and isolation, " +
                    "indexing and query cost, caching and invalidation, concurrency and idempotency, and how a " +
                    "service degrades under load."
            }

            RoleFamily.FULLSTACK_FRONTEND -> {
                "Rendering and the browser's event loop, state management and data flow between components, " +
                    "network requests and race conditions in the UI, accessibility and semantic markup, " +
                    "performance budgets (bundle size, re-renders, paint), and the API contract with the backend."
            }

            RoleFamily.MOBILE -> {
                "App and screen lifecycle, offline-first data and sync, background execution limits, battery " +
                    "and network constraints, platform-specific UI and permission models, and shipping through " +
                    "an app store's release process."
            }

            RoleFamily.QA_AUTOMATION -> {
                "The test pyramid and where each layer earns its cost, flaky tests and how to make a suite " +
                    "trustworthy again, exploratory versus scripted testing, test data and environment " +
                    "management, and what a release gate should and should not block on."
            }

            RoleFamily.DATA_ENGINEERING -> {
                "Batch versus streaming trade-offs, data modelling for analytics, idempotent and replayable " +
                    "pipelines, backfills and schema evolution, data quality checks, and orchestration failure " +
                    "modes."
            }

            RoleFamily.ML_AI -> {
                "Problem framing and what metric actually matters, train/validation/test discipline and data " +
                    "leakage, overfitting and regularisation, feature engineering versus representation " +
                    "learning, model evaluation beyond a single number, and what changes once a model is serving " +
                    "live traffic."
            }

            RoleFamily.SRE -> {
                "SLIs, SLOs and error budgets, incident response and blameless postmortems, capacity planning, " +
                    "observability (logs, metrics, traces) versus just having dashboards, deployment safety " +
                    "(canaries, rollbacks), and what pages someone at 3am and why."
            }
        }

    /** How far to push a concept, by level. Read into the same guidance so it is never skipped. */
    private fun levelDepth(level: Level): String =
        when (level) {
            Level.ENTRY -> {
                // Task 048. "Entry" here is campus hiring, and a campus fundamentals round
                // is examined on a syllabus rather than on a stack somebody has worked in:
                // a student has studied operating systems, DBMS, networks and OOP, and has
                // not run a service. A question pitched at the role family alone asks them
                // about caching strategy they have never had to choose.
                "Level: entry. Ask what a concept is and why it exists — the reasoning behind the standard " +
                    "approach, not yet its edge cases. A definition recited with no grasp of why it matters " +
                    "should fail to satisfy the follow-ups.\n\n" +
                    "This is campus and new-graduate hiring, so the ground is the degree syllabus and not a " +
                    "production stack: operating systems (processes and threads, scheduling, deadlock, memory), " +
                    "DBMS (normalisation, keys, transactions, indexes, a query they can reason about), computer " +
                    "networks (the layers, TCP against UDP, what happens when a URL is typed), object-oriented " +
                    "programming, and core data structures. Where the role family above has an equivalent, ask " +
                    "the syllabus version of it. Assume nothing they could only know from having a job."
            }

            Level.MID -> {
                "Level: mid. Expect the concept applied to a scenario with one wrinkle: a constraint that makes " +
                    "the textbook answer wrong, or a choice between two reasonable approaches."
            }

            Level.SENIOR -> {
                "Level: senior. Push on trade-offs: what this choice costs elsewhere in the system, and how " +
                    "they would justify it to someone who preferred the alternative."
            }

            Level.STAFF -> {
                "Level: staff. Push on failure modes and second-order effects — what breaks under scale, " +
                    "under partial failure, or under a requirement that changes after the design is set, and " +
                    "how they would know it had broken before a customer told them."
            }
        }
}
