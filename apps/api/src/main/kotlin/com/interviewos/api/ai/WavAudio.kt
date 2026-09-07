package com.interviewos.api.ai

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Gemini's text-to-speech returns *raw* 16-bit PCM — `audio/L16;codec=pcm;rate=24000`,
 * sample data with no container. No browser can play that: an `<audio>` element handed
 * headerless PCM simply fails to decode, which left the interviewer silent and the
 * candidate reading the question off the screen in a product whose whole premise is that
 * it is spoken.
 *
 * Wrapping the samples in a RIFF header costs 44 bytes and makes the same audio playable
 * everywhere, so speech is converted at the boundary and every caller downstream gets a
 * real `audio/wav`.
 */
object WavAudio {
    private const val HEADER_BYTES = 44
    private const val PCM_FORMAT: Short = 1
    private const val BITS_PER_SAMPLE: Short = 16

    /** Default for `audio/L16` per RFC 2586, and what Gemini's TTS emits. */
    const val DEFAULT_SAMPLE_RATE = 24_000

    /** True when [mimeType] describes headerless linear PCM rather than a container. */
    fun isRawPcm(mimeType: String): Boolean {
        val type = mimeType.lowercase()
        return type.startsWith("audio/l16") || type.startsWith("audio/l24") || type.contains("codec=pcm")
    }

    /** The `rate=` parameter of [mimeType], or [DEFAULT_SAMPLE_RATE] when it says nothing. */
    fun sampleRateOf(mimeType: String): Int =
        RATE
            .find(mimeType.lowercase())
            ?.groupValues
            ?.get(1)
            ?.toIntOrNull()
            ?.takeIf { it > 0 }
            ?: DEFAULT_SAMPLE_RATE

    /**
     * Wraps little-endian 16-bit PCM [samples] in a WAV container. Gemini emits
     * little-endian, which is also WAV's byte order, so the samples are copied verbatim.
     */
    fun wrap(
        samples: ByteArray,
        sampleRate: Int,
        channels: Int = 1,
    ): ByteArray {
        val byteRate = sampleRate * channels * BITS_PER_SAMPLE / 8
        val blockAlign = (channels * BITS_PER_SAMPLE / 8).toShort()
        val header =
            ByteBuffer
                .allocate(HEADER_BYTES)
                .order(ByteOrder.LITTLE_ENDIAN)
                .put("RIFF".toByteArray(Charsets.US_ASCII))
                // Everything after this field: the 36-byte remainder of the header plus the samples.
                .putInt(HEADER_BYTES - 8 + samples.size)
                .put("WAVE".toByteArray(Charsets.US_ASCII))
                .put("fmt ".toByteArray(Charsets.US_ASCII))
                .putInt(16)
                .putShort(PCM_FORMAT)
                .putShort(channels.toShort())
                .putInt(sampleRate)
                .putInt(byteRate)
                .putShort(blockAlign)
                .putShort(BITS_PER_SAMPLE)
                .put("data".toByteArray(Charsets.US_ASCII))
                .putInt(samples.size)
                .array()

        return ByteArrayOutputStream(HEADER_BYTES + samples.size)
            .apply {
                write(header)
                write(samples)
            }.toByteArray()
    }

    /**
     * The sample data inside [audio], with a RIFF header stripped if there is one.
     *
     * Speech leaves this boundary already wrapped, so joining two clips means unwrapping
     * both, concatenating the samples and wrapping once — see [join].
     */
    fun samplesOf(audio: ByteArray): ByteArray = if (hasRiffHeader(audio)) audio.copyOfRange(HEADER_BYTES, audio.size) else audio

    /**
     * Concatenates WAV clips of the same format into one.
     *
     * Long questions are synthesised a sentence at a time and in parallel, because
     * Gemini's speech latency scales with the length of the text — measured at 4.7s for a
     * sentence against 14.5s for a paragraph. Joining the pieces back into a single clip
     * keeps that entirely inside the speech worker: the room still receives one file and
     * one URL, and knows nothing about how it was made.
     */
    fun join(
        clips: List<ByteArray>,
        sampleRate: Int = DEFAULT_SAMPLE_RATE,
    ): ByteArray {
        val samples = ByteArrayOutputStream()
        clips.forEach { samples.write(samplesOf(it)) }
        return wrap(samples.toByteArray(), sampleRate)
    }

    private fun hasRiffHeader(audio: ByteArray): Boolean =
        audio.size >= HEADER_BYTES &&
            audio[0] == 'R'.code.toByte() &&
            audio[1] == 'I'.code.toByte() &&
            audio[2] == 'F'.code.toByte() &&
            audio[3] == 'F'.code.toByte()

    private val RATE = Regex("rate=(\\d+)")
}
