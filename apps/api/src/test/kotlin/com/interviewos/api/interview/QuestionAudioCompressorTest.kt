package com.interviewos.api.interview

import co.ntbl.lame.lowlevel.LameDecoder
import com.interviewos.api.ai.SpokenAudio
import com.interviewos.api.ai.WavAudio
import org.junit.jupiter.api.Test
import java.nio.ByteBuffer
import kotlin.math.PI
import kotlin.math.sin
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class QuestionAudioCompressorTest {
    private val compressor = Mp3QuestionAudioCompressor()

    @Test
    fun `compresses a fifteen second 24 kHz question fixture into MP3`() {
        val samples = ByteArray(15 * WavAudio.DEFAULT_SAMPLE_RATE * 2)
        for (sample in samples.indices step 2) {
            val value = (sin(2 * PI * 440 * (sample / 2) / WavAudio.DEFAULT_SAMPLE_RATE) * 8_000).toInt()
            samples[sample] = value.toByte()
            samples[sample + 1] = (value shr 8).toByte()
        }
        val wav = WavAudio.wrap(samples, WavAudio.DEFAULT_SAMPLE_RATE)

        val started = System.nanoTime()
        val result = compressor.compress(SpokenAudio(wav, "audio/wav"))
        val elapsedMs = (System.nanoTime() - started) / 1_000_000

        assertEquals("audio/mpeg", result.mimeType)
        assertTrue(result.audio.size < wav.size / 3, "The encoded question should be substantially smaller")
        assertTrue(result.audio.size > 4)
        assertTrue(
            result.audio.copyOfRange(0, 3).contentEquals("ID3".toByteArray()) ||
                (result.audio[0].toInt() and 0xff) == 0xff,
            "The output should start with an MP3 tag or frame",
        )
        val decoder = LameDecoder(result.audio)
        try {
            assertEquals(WavAudio.DEFAULT_SAMPLE_RATE, decoder.sampleRate)
            assertEquals(1, decoder.channels)
            assertTrue(decoder.decode(ByteBuffer.allocate(decoder.bufferSize)), "The MP3 must decode into audio")
        } finally {
            decoder.close()
        }
        println("QUESTION_AUDIO_BENCHMARK wav=${wav.size} mp3=${result.audio.size} encode_ms=$elapsedMs")
    }

    @Test
    fun `leaves unsupported and malformed audio untouched`() {
        val other = SpokenAudio(byteArrayOf(1, 2, 3), "audio/ogg")
        val broken = SpokenAudio(byteArrayOf(1, 2, 3), "audio/wav")

        assertContentEquals(other.audio, compressor.compress(other).audio)
        assertEquals(other.mimeType, compressor.compress(other).mimeType)
        assertContentEquals(broken.audio, compressor.compress(broken).audio)
        assertEquals(broken.mimeType, compressor.compress(broken).mimeType)
    }
}
