package com.interviewos.api.interview

import com.interviewos.api.ai.AiSpendContext
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.SpeechChunks
import com.interviewos.api.ai.SpokenAudio
import com.interviewos.api.ai.WavAudio
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.task.TaskExecutor
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID
import java.util.concurrent.CompletableFuture

/** Whether a question's voice is still rendering, ready to play, or never coming. */
enum class SpeechStatus(
    val dbValue: String,
) {
    PENDING("pending"),
    READY("ready"),
    UNAVAILABLE("unavailable"),
    ;

    companion object {
        fun fromDbValue(value: String?): SpeechStatus = entries.firstOrNull { it.dbValue == value } ?: UNAVAILABLE
    }
}

/**
 * Renders the interviewer's voice, off the critical path.
 *
 * Speech used to be synthesised inline, between the candidate finishing an answer and
 * the next question reaching them — roughly half of a measured 24-second turn, spent
 * making audio the candidate had not yet been given a reason to want. The question text
 * now returns the moment it exists and the voice catches up, usually while they are
 * still reading it.
 *
 * Two rules hold this together:
 *
 * - **The work is scheduled after the transaction commits.** The row this writes to is
 *   inserted by the caller's transaction; starting before that commits would race a
 *   background thread against a row it cannot yet see.
 * - **Failure is terminal but harmless.** A turn whose speech fails is marked
 *   `unavailable` and runs as written text. It must never leave the room waiting on a
 *   voice that is not coming, and it must never fail a round — the transcript is what
 *   the report is built from, not the audio.
 */
@Component
class QuestionSpeech(
    private val interviewAi: InterviewAi,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val repository: SessionRepository,
    @Qualifier("interviewBackgroundExecutor") private val executor: TaskExecutor,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Speaks [text] for a turn already written by the calling transaction, once that
     * transaction commits. Outside a transaction it runs immediately, which is what the
     * tests and any non-transactional caller want.
     */
    fun render(request: SpeechRequest) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            executor.execute { renderNow(request) }
            return
        }
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCommit() = executor.execute { renderNow(request) }
            },
        )
    }

    private fun renderNow(request: SpeechRequest) {
        val path =
            try {
                val spoken = speak(request)
                val objectPath = "${request.userId}/${request.sessionId}/turn-${request.turnIndex}-question.wav"
                storage.upload(storageProperties.mediaBucket, objectPath, spoken.audio, spoken.mimeType)
                objectPath
            } catch (e: AiUnavailableException) {
                log.warn("Speech unavailable for session {} turn {}; the turn runs as text", request.sessionId, request.turnIndex, e)
                null
            } catch (e: ObjectStorageException) {
                log.warn("Could not store question audio for session {} turn {}", request.sessionId, request.turnIndex, e)
                null
            }

        try {
            repository.setQuestionSpeech(
                sessionId = request.sessionId,
                userId = request.userId,
                turnIndex = request.turnIndex,
                audioPath = path,
                status = if (path != null) SpeechStatus.READY else SpeechStatus.UNAVAILABLE,
            )
        } catch (e: RuntimeException) {
            // The room polls while a turn is `pending`. Losing this write would leave it
            // polling forever, so it is worth a line in the log even though the round is
            // unaffected — the candidate still has the question in writing.
            log.error("Could not record speech state for session {} turn {}", request.sessionId, request.turnIndex, e)
        }
    }

    /**
     * The question, spoken.
     *
     * Gemini's speech latency scales with the length of the text — 4.7s for a sentence
     * against 14.5s for a paragraph, measured against the live API. A long question is
     * therefore synthesised a sentence at a time, in parallel, and the clips are joined
     * before anything is stored: the candidate waits for the slowest sentence rather than
     * for their sum, and the room still gets one file.
     *
     * A single chunk takes the direct path, so the common case adds nothing.
     */
    private fun speak(request: SpeechRequest): SpokenAudio {
        val text = request.text
        val language = request.language
        val chunks = SpeechChunks.split(text)
        // Attribution is re-established per call rather than inherited. This method is
        // already on a background thread, and the parallel path below puts each chunk on
        // a different one again, so nothing survives from the request that started it.
        // Speech is the single most expensive thing in a round, and spend that cannot be
        // traced to a session is the exact gap this ledger exists to close.
        val attributed = { block: () -> SpokenAudio -> AiSpendContext.of(request.userId, request.sessionId, block) }

        if (chunks.size == 1) return attributed { interviewAi.synthesizeSpeech(text, language).value }

        val spoken =
            chunks
                .map { chunk ->
                    CompletableFuture.supplyAsync({ attributed { interviewAi.synthesizeSpeech(chunk, language).value } }, executor)
                }.map { it.join() }

        // Any chunk arriving as something other than WAV means the assumption behind
        // joining them no longer holds, so the whole question is spoken in one call
        // instead of stitching containers that may not match.
        if (spoken.any { it.mimeType != "audio/wav" }) {
            log.warn("Speech chunks came back as {}; falling back to one call", spoken.map { it.mimeType }.distinct())
            return attributed { interviewAi.synthesizeSpeech(text, language).value }
        }

        return SpokenAudio(WavAudio.join(spoken.map { it.audio }), "audio/wav")
    }
}

data class SpeechRequest(
    val userId: UUID,
    val sessionId: UUID,
    val turnIndex: Int,
    val text: String,
    val language: String,
)
