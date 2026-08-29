package com.interviewos.api.common

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.http.InvalidMediaTypeException
import org.springframework.http.MediaType

class ContentTypesTest {
    /**
     * The bug this whole class exists for. Chrome labels a camera recording
     * `video/webm;codecs=vp9,opus`, and the comma makes that parameter an illegal token —
     * so parsing it strictly throws and answer submission died with a 500.
     */
    @Test
    fun `a browser camera recording cannot be parsed strictly`() {
        assertThatThrownBy { MediaType.parseMediaType("video/webm;codecs=vp9,opus") }
            .isInstanceOf(InvalidMediaTypeException::class.java)
    }

    @Test
    fun `drops codec parameters so the container survives`() {
        assertThat(ContentTypes.base("video/webm;codecs=vp9,opus")).isEqualTo("video/webm")
        assertThat(ContentTypes.base("audio/webm;codecs=opus")).isEqualTo("audio/webm")
        assertThat(ContentTypes.base("audio/L16;codec=pcm;rate=24000")).isEqualTo("audio/l16")
    }

    @Test
    fun `leaves a plain media type alone`() {
        assertThat(ContentTypes.base("audio/wav")).isEqualTo("audio/wav")
        assertThat(ContentTypes.base("  Application/PDF ")).isEqualTo("application/pdf")
    }

    @Test
    fun `falls back rather than passing on something that is not a media type`() {
        assertThat(ContentTypes.base(null)).isEqualTo(ContentTypes.FALLBACK)
        assertThat(ContentTypes.base("")).isEqualTo(ContentTypes.FALLBACK)
        assertThat(ContentTypes.base("webm")).isEqualTo(ContentTypes.FALLBACK)
        assertThat(ContentTypes.base("audio/")).isEqualTo(ContentTypes.FALLBACK)
        assertThat(ContentTypes.base("audio/we bm")).isEqualTo(ContentTypes.FALLBACK)
    }

    /** Whatever comes back must itself be parseable, or we have moved the crash. */
    @Test
    fun `always yields something a strict parser accepts`() {
        listOf("video/webm;codecs=vp9,opus", "audio/we bm", "", "nonsense").forEach { raw ->
            assertThat(MediaType.parseMediaType(ContentTypes.base(raw))).isNotNull()
        }
    }
}
