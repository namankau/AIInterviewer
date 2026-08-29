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

    private val RATE = Regex("rate=(\\d+)")
}
