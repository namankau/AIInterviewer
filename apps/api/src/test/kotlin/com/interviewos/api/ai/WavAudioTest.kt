package com.interviewos.api.ai

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.sound.sampled.AudioSystem

class WavAudioTest {
    @Test
    fun `recognises the headerless PCM Gemini returns`() {
        assertThat(WavAudio.isRawPcm("audio/L16;codec=pcm;rate=24000")).isTrue()
        assertThat(WavAudio.isRawPcm("audio/l16")).isTrue()
        assertThat(WavAudio.isRawPcm("audio/wav")).isFalse()
        assertThat(WavAudio.isRawPcm("audio/mpeg")).isFalse()
    }

    @Test
    fun `reads the sample rate from the mime type, and defaults when it is absent`() {
        assertThat(WavAudio.sampleRateOf("audio/L16;codec=pcm;rate=16000")).isEqualTo(16_000)
        assertThat(WavAudio.sampleRateOf("audio/L16")).isEqualTo(WavAudio.DEFAULT_SAMPLE_RATE)
        assertThat(WavAudio.sampleRateOf("audio/L16;rate=0")).isEqualTo(WavAudio.DEFAULT_SAMPLE_RATE)
    }

    /**
     * The point of the class: the result has to be decodable by something that was not
     * written by us. `AudioSystem` refuses raw PCM and accepts a well-formed RIFF file, so
     * it is a real check rather than an assertion that we wrote back what we wrote.
     */
    @Test
    fun `produces a wav a real decoder accepts`() {
        val samples = tone(sampleCount = 2_400)

        val wav = WavAudio.wrap(samples, sampleRate = 24_000)

        val stream = AudioSystem.getAudioInputStream(ByteArrayInputStream(wav))
        assertThat(stream.format.sampleRate).isEqualTo(24_000f)
        assertThat(stream.format.channels).isEqualTo(1)
        assertThat(stream.format.sampleSizeInBits).isEqualTo(16)
        assertThat(stream.readAllBytes()).isEqualTo(samples)
    }

    @Test
    fun `writes a 44 byte header and copies the samples verbatim`() {
        val samples = tone(sampleCount = 100)

        val wav = WavAudio.wrap(samples, sampleRate = 24_000)

        assertThat(wav).hasSize(44 + samples.size)
        assertThat(String(wav.copyOfRange(0, 4), Charsets.US_ASCII)).isEqualTo("RIFF")
        assertThat(String(wav.copyOfRange(8, 12), Charsets.US_ASCII)).isEqualTo("WAVE")
        assertThat(wav.copyOfRange(44, wav.size)).isEqualTo(samples)
    }

    /** A quiet ramp, in the little-endian 16-bit PCM Gemini emits. */
    private fun tone(sampleCount: Int): ByteArray {
        val buffer = ByteBuffer.allocate(sampleCount * 2).order(ByteOrder.LITTLE_ENDIAN)
        repeat(sampleCount) { index -> buffer.putShort((index % 512).toShort()) }
        return buffer.array()
    }
}
