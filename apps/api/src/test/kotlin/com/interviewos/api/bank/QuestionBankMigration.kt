package com.interviewos.api.bank

import java.io.File

/**
 * The question-bank migration, read as text so tests can check the Kotlin mirrors of its
 * SQL against the lists and vectors written in it.
 *
 * Found by content rather than by name, because the orchestrator may re-timestamp the file.
 * Gradle runs tests from `apps/api`, so the migrations are two levels up.
 */
object QuestionBankMigration {
    val text: String by lazy {
        val dir = File("../../supabase/migrations")
        val file =
            dir
                .listFiles { f -> f.name.endsWith(".sql") }
                ?.firstOrNull { it.readText(Charsets.UTF_8).contains("-- fingerprint-vectors:begin") }
                ?: error("No migration in ${dir.absolutePath} defines the fingerprint vectors")
        file.readText(Charsets.UTF_8)
    }

    /** The lines between `-- <name>:begin` and `-- <name>:end`. */
    fun block(name: String): String {
        val start = text.indexOf("-- $name:begin")
        val end = text.indexOf("-- $name:end")
        require(start >= 0 && end > start) { "No $name block in the migration" }
        return text.substring(text.indexOf('\n', start) + 1, end)
    }

    /** Every single-quoted SQL string literal in [sql], with `''` unescaped. */
    fun literals(sql: String): List<String> {
        val out = mutableListOf<String>()
        var i = 0
        while (i < sql.length) {
            if (sql[i] != '\'') {
                i++
                continue
            }
            val value = StringBuilder()
            i++
            while (i < sql.length) {
                if (sql[i] == '\'') {
                    if (i + 1 < sql.length && sql[i + 1] == '\'') {
                        value.append('\'')
                        i += 2
                        continue
                    }
                    break
                }
                value.append(sql[i])
                i++
            }
            out += value.toString()
            i++
        }
        return out
    }
}
