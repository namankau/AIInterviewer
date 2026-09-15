package com.interviewos.api.interview

import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.ProblemExample
import com.interviewos.api.ai.ProblemTestCase
import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.bank.Company
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.pool.Association
import com.interviewos.api.pool.CodingPoolPayload
import com.interviewos.api.pool.Level
import com.interviewos.api.pool.PoolQuestion
import com.interviewos.api.pool.QuestionPoolRepository
import com.interviewos.api.pool.RoleFamily
import com.interviewos.api.pool.SystemDesignPoolPayload
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.UUID
import kotlin.math.abs
import kotlin.random.Random

/**
 * What a round can ask from the AI pool, and which question it asks next (task 042).
 *
 * Reached only when the sourced bank holds nothing for this company and round type —
 * `BankRoundPlanner` keeps first claim. The pool is model knowledge: every question drawn
 * from it is [ProvenanceTier.MODEL_KNOWLEDGE] and carries [PoolQuestionLabel]'s sentence,
 * decided here from what task 039 stored and never by the model.
 */
@Component
class PoolRoundPlanner(
    private val directory: CompanyDirectory,
    private val pool: QuestionPoolRepository,
    private val repository: SessionRepository,
    private val material: PoolMaterial,
) {
    /**
     * The pool's questions for this round, ranked, or null when it has none — or when the
     * role is not one the pool is written for, which is most roles outside engineering.
     */
    fun forRound(
        companyName: String,
        archetype: Archetype,
        roundType: RoundType,
        roleTitle: String,
        experienceMonths: Int?,
    ): PoolRound? {
        val family = PoolRoundCoordinate.roleFamily(roleTitle) ?: return null
        val level = PoolRoundCoordinate.level(roleTitle, experienceMonths)
        val company = directory.resolve(companyName)
        val questions =
            pool
                .candidatesFor(company?.id, archetype, roundType, family, MAX_CANDIDATES)
                // The query already filters to these. Checked again here because this is the
                // line another company's question must never cross.
                .filter { it.coordinate.roundType == roundType && it.coordinate.roleFamily == family && it.retiredAt == null }
                .filter { PoolQuestionSelection.tierOf(it, company?.id, archetype, level) != null }
                .filter { material.isUsable(it, roundType) }
        if (questions.isEmpty()) return null
        return PoolRound(company, archetype, level, PoolQuestionSelection.rank(questions, company?.id, archetype, level))
    }

    /** The pool question this round plans to ask next, or null when the candidate has been asked every one. */
    fun next(
        userId: UUID,
        sessionId: UUID,
        round: PoolRound,
    ): PlannedFrom.Pool? {
        val asked = repository.askedPoolQuestions(userId, sessionId)
        val question =
            PoolQuestionSelection.choose(
                round = round,
                lastAsked = asked.associate { it.poolQuestionId to it.lastAskedAt },
                askedThisRound = asked.filter { it.inThisRound }.map { it.poolQuestionId }.toSet(),
                random = BankQuestionSelection.randomFor(sessionId),
            ) ?: return null
        return PlannedFrom.Pool(question, PoolQuestionLabel.of(question, round.company))
    }

    private companion object {
        /** Four levels of a coordinate's questions, for this company and the archetype, with room to spare. */
        const val MAX_CANDIDATES = 200
    }
}

/**
 * A workspace round's material, read back out of a pool question's payload (task 040's
 * shapes, `PoolPayloads.kt`).
 *
 * **This is the latency the pool exists for.** A coding question in the pool was composed and
 * its tests verified by running two independent solutions when it was generated, so a round
 * set on one makes no model call and runs no verification: the problem goes straight into the
 * workspace. A payload that does not read back as a complete, verified problem is not usable,
 * and the round composes one live instead.
 */
@Component
class PoolMaterial(
    private val objectMapper: ObjectMapper,
) {
    fun isUsable(
        question: PoolQuestion,
        roundType: RoundType,
    ): Boolean =
        when (roundType) {
            RoundType.CODING_PRACTICAL -> problemOf(question) != null
            RoundType.SYSTEM_DESIGN -> caseOf(question) != null
            else -> true
        }

    /** The verified problem [question] carries, or null when it carries none. Never has a solution in it. */
    fun problemOf(question: PoolQuestion): ComposedProblem? {
        val payload = read(question, CodingPoolPayload::class.java) ?: return null
        if (payload.kind != CodingPoolPayload.KIND || !payload.testsVerified) return null
        if (payload.testCases.isEmpty() || payload.statement.isBlank() || payload.starterPython.isBlank()) return null
        return ComposedProblem(
            // The payload stores no title. The topic stands in for one: it is already shown
            // under the title, so it gives nothing away that the page does not.
            title = "${payload.topic.trim().replaceFirstChar { it.uppercase() }} problem",
            topic = payload.topic,
            difficulty = payload.difficulty,
            statement = payload.statement,
            examples = payload.examples.map { ProblemExample(it.input, it.output, it.explanation) },
            constraints = payload.constraints,
            starterPython = payload.starterPython,
            starterJava = payload.starterJava,
            stdinFormat = payload.stdinFormat,
            testCases = payload.testCases.map { ProblemTestCase(it.input, it.expected) },
            testsVerified = true,
        )
    }

    /** The design case [question] carries: its text is the opening prompt and its follow-ups the deep dives. */
    fun caseOf(question: PoolQuestion): ComposedCase? {
        val payload = read(question, SystemDesignPoolPayload::class.java) ?: return null
        if (payload.kind != SystemDesignPoolPayload.KIND || payload.title.isBlank() || question.text.isBlank()) return null
        return ComposedCase(
            title = payload.title,
            summary = payload.summary,
            constraints = payload.constraints,
            openingPrompt = question.text,
            deepDiveOptions = question.followUps,
        )
    }

    private fun <T> read(
        question: PoolQuestion,
        type: Class<T>,
    ): T? =
        question.payload?.let {
            try {
                objectMapper.treeToValue(it, type)
            } catch (e: RuntimeException) {
                null
            }
        }
}

/** A company's or an archetype's pool questions for one round, best first. Never empty. */
data class PoolRound(
    /** Null when the directory does not know the employer: then only archetype rows are here. */
    val company: Company?,
    val archetype: Archetype,
    val level: Level,
    val questions: List<PoolQuestion>,
)

/** The question the engine planned for a turn, and which of the two stores it came from. */
sealed interface PlannedFrom {
    val text: String

    data class Bank(
        val question: BankQuestion,
    ) : PlannedFrom {
        override val text: String get() = question.text
    }

    data class Pool(
        val question: PoolQuestion,
        /** [PoolQuestionLabel]'s sentence, fixed when the question was chosen. */
        val label: String,
    ) : PlannedFrom {
        override val text: String get() = question.text
    }
}

/**
 * What the report says about a pool question, and nothing else (task 042, PRD §04).
 *
 * The employer is named only when task 039 stored the question as company-specific, with the
 * model's account of what it knows, **for this very company**. Everything else is worded
 * about the kind of employer and names no employer at all. Both sentences say it is not a
 * verified report, because it is not one.
 */
object PoolQuestionLabel {
    const val GENERATED = "Generated by our AI interviewer from general knowledge."

    fun companySpecific(company: String): String = "$GENERATED Not a verified report of a question $company asked."

    fun employerKind(archetype: Archetype): String = "$GENERATED Not a verified report of a question asked at ${kindOf(archetype)}."

    /** Only ever decides downwards: anything short of a licensed claim about [company] reads as the kind of employer. */
    fun of(
        question: PoolQuestion,
        company: Company?,
    ): String {
        val licensed =
            question.association == Association.COMPANY_SPECIFIC &&
                !question.knowledgeBasis.isNullOrBlank() &&
                company != null &&
                question.coordinate.companyId == company.id
        return if (licensed) companySpecific(checkNotNull(company).name) else employerKind(question.coordinate.archetype)
    }

    /** The archetype as a noun phrase, article and all. Exhaustive, so a new archetype cannot fall through to a bad sentence. */
    fun kindOf(archetype: Archetype): String =
        when (archetype) {
            Archetype.GLOBAL_PRODUCT -> "a global product company"
            Archetype.INDIAN_PRODUCT -> "an Indian product company or startup"
            Archetype.SERVICE_BASED_IT -> "a service-based IT firm"
            Archetype.CONSULTING_BIG_FOUR -> "a consulting or Big Four firm"
            Archetype.EUROPEAN_EMPLOYER -> "a European employer"
            Archetype.GCC_CAPTIVE -> "a GCC or captive centre"
            Archetype.REGULATED_PROFESSIONAL -> "a regulated professional practice"
            Archetype.INDUSTRIAL_MANUFACTURING -> "an industrial or manufacturing employer"
        }
}

/**
 * Which pool question a round asks next. Pure, so the order is tested without a database.
 *
 * The fallback order is the task's: this company at the candidate's level, then this company
 * at the nearest level, then the archetype-level rows the same way. A round draws from the
 * best tier that still has a question this candidate has not been asked, and only from it.
 */
object PoolQuestionSelection {
    /**
     * Where [question] sits in the fallback order for a round, lower first; null when it is
     * not this round's to offer at all — another company's row, or another archetype's.
     */
    fun tierOf(
        question: PoolQuestion,
        companyId: UUID?,
        archetype: Archetype,
        level: Level,
    ): Int? {
        val ownCompany = companyId != null && question.coordinate.companyId == companyId
        val archetypeRow = question.coordinate.companyId == null && question.coordinate.archetype == archetype
        val offset = question.coordinate.level.ordinal - level.ordinal
        // Nearest level first, and of two equally near the lower: a mid-level candidate falls
        // back to entry before senior, because too easy a question costs less than an unfair one.
        val step = abs(offset) * 2 + if (offset > 0) 1 else 0
        return when {
            ownCompany -> step
            archetypeRow -> Level.entries.size * 2 + step
            else -> null
        }
    }

    /**
     * Best tier first. Within a tier: a licensed company-specific question before an
     * employer-kind one, a reviewed question before an unreviewed one, then the order the
     * repository returned.
     */
    fun rank(
        questions: List<PoolQuestion>,
        companyId: UUID?,
        archetype: Archetype,
        level: Level,
    ): List<PoolQuestion> =
        questions
            .filter { tierOf(it, companyId, archetype, level) != null }
            .sortedWith(
                compareBy<PoolQuestion> { tierOf(it, companyId, archetype, level) }
                    .thenBy { if (it.association == Association.COMPANY_SPECIFIC) 0 else 1 }
                    .thenBy { if (it.reviewedAt != null) 0 else 1 },
            )

    /**
     * The question to plan next, or null when every question in [round] has been asked of
     * this candidate — in this round or any earlier one. The pool never repeats a question:
     * live questions are the floor beneath it.
     */
    fun choose(
        round: PoolRound,
        lastAsked: Map<UUID, Instant>,
        askedThisRound: Set<UUID>,
        random: Random,
    ): PoolQuestion? {
        val tier = { q: PoolQuestion -> tierOf(q, round.company?.id, round.archetype, round.level) }
        val best =
            round.questions
                .firstOrNull { it.id !in lastAsked && it.id !in askedThisRound }
                ?.let(tier) ?: return null
        return BankQuestionSelection.pick(
            ranked = round.questions.filter { tier(it) == best },
            idOf = PoolQuestion::id,
            lastAsked = lastAsked,
            askedThisRound = askedThisRound,
            random = random,
            recycle = false,
        )
    }
}

/**
 * The pool coordinate a session reads from: the role family and level, inferred from the role
 * the candidate typed and, for the level, their resume.
 *
 * Deliberately narrow. A role the pool is not written for gets no family, and so no pool
 * question — a backend question handed to a product manager is worse than a live one.
 */
object PoolRoundCoordinate {
    fun roleFamily(roleTitle: String): RoleFamily? {
        val title = normalised(roleTitle)
        return FAMILY_WORDS.firstOrNull { (_, words) -> words.any { title.contains(" $it ") } }?.first
    }

    /**
     * The level the role is at. The title decides when it says — the round is for the job
     * being applied to, not the last one held — and otherwise the resume's experience does.
     * Mid level when neither says anything.
     */
    fun level(
        roleTitle: String,
        experienceMonths: Int?,
    ): Level {
        val title = normalised(roleTitle)
        val says = { words: List<String> -> words.any { title.contains(" $it ") } }
        return when {
            says(STAFF_WORDS) && !title.contains(" technical staff ") -> Level.STAFF
            says(SENIOR_WORDS) -> Level.SENIOR
            says(ENTRY_WORDS) -> Level.ENTRY
            says(MID_WORDS) -> Level.MID
            experienceMonths == null -> Level.MID
            experienceMonths < ENTRY_BELOW_MONTHS -> Level.ENTRY
            experienceMonths < MID_BELOW_MONTHS -> Level.MID
            else -> Level.SENIOR
        }
    }

    private fun normalised(title: String): String = " " + title.lowercase().replace(NON_WORD, " ").trim() + " "

    private val NON_WORD = Regex("[^a-z0-9]+")
    private const val ENTRY_BELOW_MONTHS = 24
    private const val MID_BELOW_MONTHS = 60

    /** Checked in order: the first family with a word in the title wins. */
    private val FAMILY_WORDS: List<Pair<RoleFamily, List<String>>> =
        listOf(
            RoleFamily.ML_AI to
                listOf(
                    "machine learning", "ml", "ai", "mlops", "llm", "nlp", "computer vision", "deep learning",
                    "data scientist", "applied scientist", "research scientist",
                ),
            RoleFamily.DATA_ENGINEERING to
                listOf("data engineer", "data engineering", "etl", "big data", "analytics engineer", "data platform"),
            RoleFamily.SRE to
                listOf("sre", "site reliability", "devops", "dev ops", "platform engineer", "infrastructure engineer", "cloud engineer"),
            RoleFamily.QA_AUTOMATION to
                listOf("qa", "sdet", "test automation", "automation test", "automation tester", "quality assurance", "test engineer", "tester"),
            RoleFamily.MOBILE to listOf("android", "ios", "mobile", "flutter", "react native"),
            RoleFamily.FULLSTACK_FRONTEND to
                listOf("frontend", "front end", "full stack", "fullstack", "ui engineer", "ui developer", "web developer", "react", "angular"),
            RoleFamily.BACKEND to
                listOf(
                    "backend", "back end", "software engineer", "software developer", "software development engineer",
                    "sde", "sde1", "sde2", "sde3", "swe", "developer", "programmer", "programmer analyst",
                    "member of technical staff", "mts", "systems engineer", "system engineer",
                ),
        )

    private val STAFF_WORDS = listOf("staff", "principal", "distinguished")
    private val SENIOR_WORDS = listOf("senior", "sr", "lead", "sde 3", "sde3", "sde iii")
    private val ENTRY_WORDS =
        listOf(
            "intern", "internship", "graduate", "grad", "fresher", "junior", "jr", "entry", "trainee",
            "apprentice", "associate", "sde 1", "sde1", "sde i",
        )
    private val MID_WORDS = listOf("mid", "intermediate", "sde 2", "sde2", "sde ii")
}
