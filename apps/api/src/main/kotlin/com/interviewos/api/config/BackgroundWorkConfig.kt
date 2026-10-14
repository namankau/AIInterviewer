package com.interviewos.api.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.task.SimpleAsyncTaskExecutor
import org.springframework.core.task.TaskExecutor

/**
 * Separate bounded executors for storage uploads and optional speech.
 *
 * Speech can be slow without consuming the slots reserved for answer uploads. Rejecting
 * at capacity keeps both request and after-commit threads from waiting for a permit.
 *
 * Tasks are I/O bound — an HTTP call to Gemini, then one to storage — so they run on
 * virtual threads. Speech's Gemini calls are bounded separately by QuestionSpeech.
 */
@Configuration
class BackgroundWorkConfig {
    @Bean(name = ["interviewUploadExecutor"])
    fun interviewUploadExecutor(): TaskExecutor = boundedExecutor("interview-upload-", MAX_CONCURRENT_UPLOADS)

    @Bean(name = ["interviewSpeechExecutor"])
    fun interviewSpeechExecutor(): TaskExecutor = boundedExecutor("interview-speech-", MAX_CONCURRENT_SPEECH_TASKS)

    private fun boundedExecutor(
        prefix: String,
        limit: Int,
    ): TaskExecutor =
        SimpleAsyncTaskExecutor(prefix).apply {
            setVirtualThreads(true)
            setConcurrencyLimit(limit)
            setRejectTasksWhenLimitReached(true)
        }

    private companion object {
        const val MAX_CONCURRENT_UPLOADS = 32
        const val MAX_CONCURRENT_SPEECH_TASKS = 32
    }
}
