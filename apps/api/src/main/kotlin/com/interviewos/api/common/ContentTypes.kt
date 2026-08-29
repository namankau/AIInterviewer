package com.interviewos.api.common

/**
 * Media types as browsers actually send them.
 *
 * `MediaRecorder` labels its output with the codecs it picked — a camera answer arrives
 * as `video/webm;codecs=vp9,opus`. That comma is a separator in HTTP's token grammar, so
 * the parameter is illegal unquoted and every strict parser throws on it. Passing the
 * raw string to `MediaType.parseMediaType` took down answer submission with a 500.
 *
 * Nothing downstream reads the codec list. The container is what Supabase Storage stores
 * and what Gemini demuxes, so we keep type/subtype and drop the parameters — and refuse
 * to guess when what is left is not a media type at all.
 */
object ContentTypes {
    const val FALLBACK = "application/octet-stream"

    /** Separators from RFC 9110's token grammar. None may appear unquoted in a token. */
    private val SEPARATORS = "()<>@,;:\\\"/[]?={} \t".toSet()

    /**
     * The `type/subtype` of [raw], lowercased, with parameters removed. Falls back to
     * [FALLBACK] for anything that is absent or malformed, so a hostile or novel value
     * from a client degrades to an opaque blob rather than failing the request.
     */
    fun base(raw: String?): String {
        val candidate = raw?.substringBefore(';')?.trim()?.lowercase() ?: return FALLBACK
        val type = candidate.substringBefore('/')
        val subtype = candidate.substringAfter('/', missingDelimiterValue = "")
        return if (isToken(type) && isToken(subtype)) "$type/$subtype" else FALLBACK
    }

    private fun isToken(value: String): Boolean = value.isNotEmpty() && value.none { it in SEPARATORS || it.isISOControl() }
}
