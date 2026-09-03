package com.interviewos.api.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.task.SimpleAsyncTaskExecutor
import org.springframework.core.task.TaskExecutor

/**
 * The executor for work a candidate is not waiting on.
 *
 * Today that is one thing: synthesising the interviewer's voice after the question text
 * has already been sent. Declared explicitly rather than borrowing Spring's
 * `applicationTaskExecutor`, so that what runs off the request thread is a deliberate,
 * named list rather than whatever happens to autowire.
 *
 * Tasks are I/O bound — an HTTP call to Gemini, then one to storage — so they run on
 * virtual threads, and the concurrency limit is about bounding spend on a runaway rather
 * than about platform threads: one in-flight synthesis per turn is the expected load,
 * and anything far above that is a bug worth queueing rather than paying for.
 */
@Configuration
class BackgroundWorkConfig {
    @Bean(name = ["interviewBackgroundExecutor"])
    fun interviewBackgroundExecutor(): TaskExecutor =
        SimpleAsyncTaskExecutor("interview-bg-").apply {
            setVirtualThreads(true)
            setConcurrencyLimit(MAX_CONCURRENT_BACKGROUND_TASKS)
        }

    private companion object {
        const val MAX_CONCURRENT_BACKGROUND_TASKS = 32
    }
}
