package com.interviewos.api.ai

/**
 * What a call actually needs from a model.
 *
 * This exists because "fall back to another model" is not one decision, it is four. The
 * interview loop asks Gemini for things that are not interchangeable:
 *
 * - most calls are **text in, JSON out**, and any competent model can serve them
 * - assessing an answer sends the candidate's **recorded voice**, and optionally video
 * - parsing a resume sends a **PDF or Word file**
 * - the interviewer's voice is **speech synthesis**
 *
 * Kimi, DeepSeek and the rest are text-only. Routing an answer-assessment to one would
 * not degrade the round, it would break it — the model would be handed audio it cannot
 * hear and would either error or, far worse, invent a transcript. So a provider declares
 * what it can actually do, and the fallback chain only ever offers it work it can serve.
 */
enum class AiCapability {
    /** Text prompt, structured JSON back. The bulk of the loop. */
    STRUCTURED_TEXT,

    /** Understanding recorded speech, and video when the candidate consented to it. */
    AUDIO_UNDERSTANDING,

    /** Reading a PDF or Word document. */
    DOCUMENT_UNDERSTANDING,

    /** Speaking a question aloud. */
    SPEECH_SYNTHESIS,
}
