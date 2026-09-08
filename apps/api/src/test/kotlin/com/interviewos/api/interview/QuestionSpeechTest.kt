package com.interviewos.api.interview

import com.interviewos.api.ai.AiCapability
import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.AnswerVideo
import com.interviewos.api.ai.AskedQuestion
import com.interviewos.api.ai.ComposedRound
import com.interviewos.api.ai.ExtractedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.OfferedHint
import com.interviewos.api.ai.ParsedResume
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.ai.ResumeFile
import com.interviewos.api.ai.RoundContext
import com.interviewos.api.ai.SourceDocument
import com.interviewos.api.ai.SpokenAudio
import com.interviewos.api.ai.TurnTranscript
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageProperties
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.springframework.core.task.SyncTaskExecutor
import java.util.UUID
import kotlin.test.assertEquals

/**
 * The interviewer's voice is rendered after the question text has already been sent, so
 * the room polls until the turn says the voice is ready — or says it is not coming.
 *
 * The behaviour worth pinning down is the second half. A turn left `pending` because
 * synthesis or storage failed would have the room polling for a voice that will never
 * arrive, which is a worse failure than no voice at all: the candidate can always read
 * the question.
 */
class QuestionSpeechTest {
    private val userId = UUID.randomUUID()
    private val sessionId = UUID.randomUUID()

    @Test
    fun `stores the rendered voice and marks the turn ready`() {
        val storage = RecordingStorage()
        val repository = mock(SessionRepository::class.java)

        speech(ai = SpeakingAi(), storage = storage, repository = repository)
            .render(SpeechRequest(userId, sessionId, turnIndex = 2, text = "Walk me through it.", language = "english"))

        assertEquals(1, storage.uploads.size)
        val (path, contentType) = storage.uploads.single()
        assertEquals("$userId/$sessionId/turn-2-question.wav", path)
        assertEquals("audio/wav", contentType)

        verify(repository).setQuestionSpeech(sessionId, userId, 2, path, SpeechStatus.READY)
    }

    @Test
    fun `marks the turn unavailable when speech cannot be synthesised`() {
        val repository = mock(SessionRepository::class.java)

        speech(ai = SilentAi(), storage = RecordingStorage(), repository = repository)
            .render(SpeechRequest(userId, sessionId, turnIndex = 0, text = "Tell me about yourself.", language = "english"))

        // Not `pending`: the room has to stop waiting and let the round run as text.
        verify(repository).setQuestionSpeech(sessionId, userId, 0, null, SpeechStatus.UNAVAILABLE)
    }

    @Test
    fun `marks the turn unavailable when the audio cannot be stored`() {
        val repository = mock(SessionRepository::class.java)

        speech(ai = SpeakingAi(), storage = FailingStorage(), repository = repository)
            .render(SpeechRequest(userId, sessionId, turnIndex = 1, text = "And then?", language = "english"))

        verify(repository).setQuestionSpeech(sessionId, userId, 1, null, SpeechStatus.UNAVAILABLE)
    }

    @Test
    fun `an unknown speech state reads as unavailable rather than as a wait`() {
        assertEquals(SpeechStatus.UNAVAILABLE, SpeechStatus.fromDbValue(null))
        assertEquals(SpeechStatus.UNAVAILABLE, SpeechStatus.fromDbValue("something-else"))
        assertEquals(SpeechStatus.PENDING, SpeechStatus.fromDbValue("pending"))
        assertEquals(SpeechStatus.READY, SpeechStatus.fromDbValue("ready"))
    }

    private fun speech(
        ai: InterviewAi,
        storage: ObjectStorage,
        repository: SessionRepository,
    ) = QuestionSpeech(
        interviewAi = ai,
        storage = storage,
        storageProperties = StorageProperties(),
        repository = repository,
        // No transaction is open here, so rendering runs inline and the assertions can
        // read its effects without waiting on a background thread.
        executor = SyncTaskExecutor(),
    )
}

private class RecordingStorage : ObjectStorage {
    val uploads = mutableListOf<Pair<String, String>>()

    override fun upload(
        bucket: String,
        path: String,
        bytes: ByteArray,
        contentType: String,
    ) {
        uploads += path to contentType
    }

    override fun download(
        bucket: String,
        path: String,
    ): ByteArray = ByteArray(0)

    override fun createSignedUrl(
        bucket: String,
        path: String,
        expiresInSeconds: Int,
    ): String = "https://storage.test/$path"

    override fun deleteByPrefix(
        bucket: String,
        prefix: String,
    ) = Unit
}

private class FailingStorage : ObjectStorage {
    override fun upload(
        bucket: String,
        path: String,
        bytes: ByteArray,
        contentType: String,
    ): Unit = throw ObjectStorageException("bucket unreachable")

    override fun download(
        bucket: String,
        path: String,
    ): ByteArray = throw ObjectStorageException("bucket unreachable")

    override fun createSignedUrl(
        bucket: String,
        path: String,
        expiresInSeconds: Int,
    ): String = throw ObjectStorageException("bucket unreachable")

    override fun deleteByPrefix(
        bucket: String,
        prefix: String,
    ): Unit = throw ObjectStorageException("bucket unreachable")
}

/** Only speech is exercised here; the rest of the port is not reached. */
private abstract class StubAi : InterviewAi {
    override val providerName: String = "stub"

    override val capabilities: Set<AiCapability> = AiCapability.entries.toSet()

    override fun parseResume(file: ResumeFile): AiResult<ParsedResume> = unsupported()

    override fun composeRound(query: String): AiResult<ComposedRound> = unsupported()

    override fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion> = unsupported()

    override fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
        video: AnswerVideo?,
    ): AiResult<AnswerAssessment> = unsupported()

    override fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): AiResult<OfferedHint> = unsupported()

    override fun extractQuestions(source: SourceDocument): AiResult<ExtractedQuestions> = unsupported()

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> = unsupported()

    private fun unsupported(): Nothing = throw UnsupportedOperationException("not part of this test")
}

private class SpeakingAi : StubAi() {
    override fun synthesizeSpeech(
        text: String,
        language: String,
    ) = AiResult(SpokenAudio(byteArrayOf(1, 2, 3), "audio/wav"), AiUsage("test-tts", 0, 0))
}

private class SilentAi : StubAi() {
    override fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio> = throw AiUnavailableException("no speech today")
}
