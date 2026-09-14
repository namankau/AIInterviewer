package com.interviewos.api.interview

import com.interviewos.api.bank.BankQuestion
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.random.Random

/**
 * Which question from the bank a round asks next.
 *
 * The candidates are the company's own questions for this round type — exact company, never
 * an archetype sibling (that is decided by `CompanyDirectory` before anything gets here).
 * Pure, so the rules are tested without a database or a model.
 */
object BankQuestionSelection {
    /**
     * How many of the best-ranked questions the choice is made among. One would ask every
     * candidate for Amazon the same question first; the whole bank would make the rarely
     * reported ones as likely as the ones twenty people describe.
     */
    const val TOP_FEW = 3

    /**
     * The question to plan next, or null when there is nothing left to ask in this round.
     *
     * @param candidates the company's questions for this round type
     * @param lastAsked when this candidate was last asked each question, in any round
     * @param askedThisRound questions already asked in this round, which never come back in it
     * @param random seeded per round, so the plan is stable from one turn to the next
     */
    fun choose(
        companyId: UUID,
        candidates: List<BankQuestion>,
        lastAsked: Map<UUID, Instant>,
        askedThisRound: Set<UUID>,
        random: Random,
    ): BankQuestion? {
        val available = rank(companyId, candidates).filter { it.id !in askedThisRound }
        if (available.isEmpty()) return null

        val fresh = available.filter { it.id !in lastAsked }
        if (fresh.isNotEmpty()) return fresh.take(TOP_FEW).let { it[random.nextInt(it.size)] }

        // Every one has been asked before. The one asked longest ago comes back first, with
        // rank breaking ties, so a candidate going round again meets them in the order they
        // have had longest to forget.
        return available.minWith(compareBy<BankQuestion> { lastAsked.getValue(it.id) })
    }

    /** Most corroborated at this company first, then most recently reported. Stable otherwise. */
    fun rank(
        companyId: UUID,
        candidates: List<BankQuestion>,
    ): List<BankQuestion> =
        candidates.sortedWith(
            compareByDescending<BankQuestion> { it.tagFor(companyId)?.corroboration ?: it.corroboration }
                .thenByDescending { it.tagFor(companyId)?.lastReported ?: it.lastReported ?: LocalDate.MIN },
        )

    /** The same round always draws the same way, and different rounds draw differently. */
    fun randomFor(sessionId: UUID): Random = Random(sessionId.mostSignificantBits xor sessionId.leastSignificantBits)
}

/**
 * Whether the interviewer actually asked the bank question it was given.
 *
 * The model may introduce a question and shape it for speech. It may not change what is
 * asked — a question stamped `published_source` has to be the one the source reports. So
 * the engine checks, by containment: most of the bank question's content words must be in
 * what was said. Word order, filler and a lead-in are free; a different question is not.
 */
object PlannedQuestionCheck {
    /**
     * Share of the bank question's content words that must appear in what was said.
     *
     * Chosen against the cases in `PlannedQuestionCheckTest`: a question reworded for speech
     * with a word or two dropped passes; the same topic asked as a different question —
     * "describe a conflict with your boss" for "tell me about a time you disagreed with your
     * manager" — shares none of its content words and fails.
     */
    const val THRESHOLD = 0.7

    /** What the candidate is asked, and whether it is the bank question. */
    data class Delivery(
        val text: String,
        /** True when the model's own wording passed; false when the bank text was put back. */
        val faithful: Boolean,
    )

    fun containment(
        delivered: String,
        bankText: String,
    ): Double {
        val wanted = contentWords(bankText)
        if (wanted.isEmpty()) return 1.0
        val said = contentWords(delivered)
        return wanted.count { it in said }.toDouble() / wanted.size
    }

    fun asks(
        delivered: String,
        bankText: String,
    ): Boolean = containment(delivered, bankText) >= THRESHOLD

    /**
     * What goes in front of the candidate when the bank question has to be asked.
     *
     * The model's wording when it passes. Otherwise the bank text, after whatever the model
     * said to lead into it — so a briefing on how the round will run is kept, and the
     * question it ended on is replaced.
     */
    fun deliver(
        delivered: String?,
        bankText: String,
    ): Delivery {
        val said = delivered?.trim().orEmpty()
        if (said.isNotEmpty() && asks(said, bankText)) return Delivery(said, faithful = true)
        val leadIn = leadIn(said)
        val question = bankText.trim()
        return Delivery(if (leadIn.isEmpty()) question else "$leadIn $question", faithful = false)
    }

    /** What a turn asks, and the bank question behind it when it asks one. */
    data class AskedTurn(
        val text: String,
        val bankQuestion: BankQuestion?,
        /** False when the model's wording was replaced with the bank's. */
        val faithful: Boolean = true,
    )

    /**
     * Decides whether the next turn asks [planned], and what the candidate hears.
     *
     * - [askNow] — the first question of the round proper — or the model saying it asked it:
     *   the planned question is asked, in the model's words if they pass, otherwise in the
     *   bank's after the model's lead-in.
     * - The model saying nothing, but its wording asking the planned question anyway: that is
     *   the planned question too, and labelled as such.
     * - Otherwise a follow-up or a question of its own, with no bank question behind it.
     */
    fun resolveTurn(
        planned: BankQuestion?,
        askNow: Boolean,
        modelSaysAsked: Boolean?,
        said: String,
    ): AskedTurn {
        if (planned == null) return AskedTurn(said, null)
        if (askNow || modelSaysAsked == true) {
            val delivery = deliver(said, planned.text)
            return AskedTurn(delivery.text, planned, delivery.faithful)
        }
        if (asks(said, planned.text)) return AskedTurn(said, planned)
        return AskedTurn(said, null)
    }

    /**
     * Everything before the question the model ended on, stopping at any other question.
     *
     * The last sentence is always taken to be the ask. Earlier sentences are kept only up to
     * the first one that is itself a question, so the candidate is never asked two things.
     */
    internal fun leadIn(delivered: String): String {
        val sentences =
            delivered
                .trim()
                .split(SENTENCE_BREAK)
                .map { it.trim() }
                .filter { it.isNotEmpty() }
        if (sentences.size < 2) return ""
        return sentences
            .dropLast(1)
            .takeWhile { !it.endsWith("?") }
            .joinToString(" ")
    }

    internal fun contentWords(text: String): Set<String> =
        text
            .lowercase()
            .replace("’", "'")
            .split(NON_WORD)
            .map { it.trim('\'') }
            .filter { it.isNotEmpty() && it !in STOP_WORDS }
            .map(::stem)
            .toSet()

    /** Crude on purpose: enough that "shortener" meets "shortening" and "handles" meets "handling". */
    private fun stem(word: String): String {
        for (suffix in SUFFIXES) {
            if (word.length - suffix.length >= MIN_STEM && word.endsWith(suffix)) return word.dropLast(suffix.length)
        }
        return word
    }

    private const val MIN_STEM = 3
    private val SUFFIXES = listOf("ing", "ed", "es", "er", "s", "e")
    private val SENTENCE_BREAK = Regex("(?<=[.!?])\\s+")
    private val NON_WORD = Regex("[^a-z0-9']+")
    private val STOP_WORDS =
        (
            "a an the and or but of to in on at for with by from as is are was were be been it its this " +
                "that these those you your yours me my i we our us they their he she him her can could " +
                "would will should do does did have has had so if then about how what when where which who " +
                "why please let's lets let now just some any i'd i'm you've you'd okay ok right walk " +
                "through tell describe explain give talk like"
        ).split(' ').toSet()
}
