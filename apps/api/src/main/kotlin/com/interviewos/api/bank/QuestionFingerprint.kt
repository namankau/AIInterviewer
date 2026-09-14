package com.interviewos.api.bank

/**
 * The definition of "the same question" in the bank.
 *
 * Mirrors `public.question_fingerprint` in `20260914000000_question_bank.sql`, which is the
 * one the database stores. The two are checked against the same vectors — the migration
 * checks the SQL when it is applied, and `QuestionFingerprintTest` reads those vectors out
 * of the migration and checks this.
 *
 * The rule is deliberately independent of locale and of any Unicode table, because the
 * alternative disagrees silently: `lower()` on a database whose locale differs from the
 * JVM's would split one question into two rows, and nothing would ever fail. So only ASCII
 * changes case, a fixed list of typographic characters is folded, and every other non-ASCII
 * character is kept as written — a question in Devanagari keeps every character it had.
 */
object QuestionFingerprint {
    /** The normalised form. Empty when the text has nothing but punctuation in it. */
    fun of(text: String): String {
        val folded = StringBuilder(text.length)
        for (c in text) {
            when {
                c in 'A'..'Z' -> folded.append(c + ('a' - 'A'))
                c in APOSTROPHES -> Unit
                c in SEPARATORS -> folded.append(' ')
                else -> folded.append(c)
            }
        }
        return folded.toString().replace(ASCII_SEPARATORS, " ").trim(' ')
    }

    /**
     * The wording stored for a question: runs of ASCII whitespace collapsed, ends trimmed.
     *
     * Only ASCII whitespace, because every one of those characters is already a separator
     * in [of] — so tidying the wording can never change which question it is.
     */
    fun canonicalText(text: String): String = text.replace(ASCII_WHITESPACE, " ").trim(' ')

    /** Deleted: `'`, U+2018, U+2019. "What's" and "Whats" are the same question. */
    private val APOSTROPHES = setOf('\'', '\u2018', '\u2019')

    /**
     * Typographic characters read as a space. The same code points as the SQL's `chr()`
     * list, in the same order: no-break space, guillemets, zero-width space, the hyphen
     * and dash family, curly double quotes, bullet, ellipsis, minus sign, byte-order mark.
     */
    private val SEPARATORS =
        setOf(
            '\u00A0',
            '\u00AB',
            '\u00BB',
            '\u200B',
            '\u2010',
            '\u2011',
            '\u2012',
            '\u2013',
            '\u2014',
            '\u2015',
            '\u201C',
            '\u201D',
            '\u201E',
            '\u2022',
            '\u2026',
            '\u2212',
            '\uFEFF',
        )

    /** ASCII other than a-z, 0-9, `#` and `+` (so C++ and C# stay distinct from C). */
    private val ASCII_SEPARATORS = Regex("[\\x00-\\x22\\x24-\\x2a\\x2c-\\x2f\\x3a-\\x60\\x7b-\\x7f]+")

    private val ASCII_WHITESPACE = Regex("[\\x09-\\x0d\\x20]+")
}
