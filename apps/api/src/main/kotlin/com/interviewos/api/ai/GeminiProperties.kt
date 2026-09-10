package com.interviewos.api.ai

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Gemini configuration. Model ids are fixed by CLAUDE.md: `gemini-3.5-flash` for
 * reasoning, audio understanding and scoring; `gemini-2.5-flash-preview-tts` for the
 * interviewer's voice. `gemini-2.5-pro` 404s for new keys — do not reach for it.
 */
@ConfigurationProperties(prefix = "interviewos.gemini")
data class GeminiProperties(
    val apiKey: String = "",
    val baseUrl: String = "https://generativelanguage.googleapis.com/v1beta",
    val reasoningModel: String = "gemini-3.5-flash",
    val speechModel: String = "gemini-2.5-flash-preview-tts",
    /** One of Gemini's prebuilt TTS voices. */
    val voiceName: String = "Kore",
) {
    val configured: Boolean
        get() = apiKey.isNotBlank()
}
