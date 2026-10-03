package com.interviewos.api.storage

/**
 * The part of a storage key that comes from a user's file name, made safe to put there.
 *
 * Object keys are paths, and ownership is the first segment (`{userId}/…`). A file name is
 * whatever the browser sent, so `../` or a `/` in it would be a way to write outside the
 * caller's own prefix. Only a short run of plain characters survives; the original name is
 * kept separately, as data, wherever it is shown back.
 */
object StorageKeys {
    private const val MAX_LENGTH = 80
    private val UNSAFE = Regex("""[^A-Za-z0-9._-]""")
    private val DOT_RUNS = Regex("""\.{2,}""")

    fun safeFileName(
        original: String?,
        fallback: String,
    ): String =
        original
            ?.substringAfterLast('/')
            ?.substringAfterLast('\\')
            ?.replace(UNSAFE, "_")
            ?.replace(DOT_RUNS, ".")
            ?.trim('.', '_')
            ?.takeLast(MAX_LENGTH)
            ?.takeIf { it.isNotEmpty() }
            ?: fallback
}
