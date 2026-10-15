package com.interviewos.api.interview

import co.ntbl.lame.lowlevel.LameEncoder
import co.ntbl.lame.mp3.Lame
import co.ntbl.lame.mp3.MPEGMode
import com.interviewos.api.ai.SpokenAudio
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.sound.sampled.AudioFormat
import javax.sound.sampled.AudioSystem

/** Shrinks a generated question before it is stored and sent over a mobile connection. */
fun interface QuestionAudioCompressor {
    fun compress(audio: SpokenAudio): SpokenAudio
}

/** MP3 is playable in the browsers the room supports, including older mobile Safari. */
@Component
class Mp3QuestionAudioCompressor : QuestionAudioCompressor {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun compress(audio: SpokenAudio): SpokenAudio {
        if (audio.mimeType != "audio/wav") return audio
        return try {
            val encoded = encode(audio.audio)
            if (encoded.size >= audio.audio.size) audio else SpokenAudio(encoded, "audio/mpeg")
        } catch (e: Exception) {
            // Compression must never turn a spoken question into a silent one.
            log.warn("Question audio compression failed; storing the original WAV", e)
            audio
        }
    }

    private fun encode(wav: ByteArray): ByteArray =
        AudioSystem.getAudioInputStream(ByteArrayInputStream(wav)).use { input ->
            val format = input.format
            require(
                format.encoding == AudioFormat.Encoding.PCM_SIGNED && format.channels == 1 &&
                    format.sampleSizeInBits == 16 && !format.isBigEndian,
            ) {
                "Question speech must be mono, little-endian, 16-bit PCM"
            }
            val pcm = input.readAllBytes()
            val encoder = LameEncoder(format, BIT_RATE_KBPS, MPEGMode.MONO, Lame.QUALITY_MIDDLE, false)
            try {
                val output = ByteArrayOutputStream(pcm.size / 4)
                val buffer = ByteArray(encoder.pcmBufferSize * 2)
                var offset = 0
                while (offset < pcm.size) {
                    val size = minOf(encoder.pcmBufferSize, pcm.size - offset)
                    val encoded = encoder.encodeBuffer(pcm, offset, size, buffer)
                    output.write(buffer, 0, encoded)
                    offset += size
                }
                output.write(buffer, 0, encoder.encodeFinish(buffer))
                output.toByteArray()
            } finally {
                encoder.close()
            }
        }

    private companion object {
        const val BIT_RATE_KBPS = 64
    }
}
