package com.interviewos.api.config

import org.junit.jupiter.api.Test
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.core.task.SimpleAsyncTaskExecutor
import org.springframework.core.task.TaskExecutor
import org.springframework.core.task.TaskRejectedException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class BackgroundWorkConfigTest {
    @Test
    fun `background executor is registered for its qualified consumers`() {
        AnnotationConfigApplicationContext(BackgroundWorkConfig::class.java).use { context ->
            assertTrue(context.getBean("interviewBackgroundExecutor", TaskExecutor::class.java) is SimpleAsyncTaskExecutor)
        }
    }

    @Test
    fun `speech saturation rejects promptly`() {
        val config = BackgroundWorkConfig()
        val speech = config.interviewSpeechExecutor()
        val occupied = CountDownLatch(32)
        val release = CountDownLatch(1)
        try {
            repeat(32) {
                speech.execute {
                    occupied.countDown()
                    release.await()
                }
            }
            assertTrue(occupied.await(3, TimeUnit.SECONDS))

            val started = System.nanoTime()
            repeat(8) { assertFailsWith<TaskRejectedException> { speech.execute {} } }
            val submitMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)
            assertTrue(submitMillis < 500, "Eight rejected submits took ${submitMillis}ms")

            // Same 32 occupied slots with the old blocking setting, and a short stub
            // delay. This is a comparison measurement, not a CI timing threshold.
            val baseline =
                SimpleAsyncTaskExecutor("blocking-baseline-").apply {
                    setVirtualThreads(true)
                    setConcurrencyLimit(32)
                }
            val baselineOccupied = CountDownLatch(32)
            val baselineRelease = CountDownLatch(1)
            try {
                repeat(32) {
                    baseline.execute {
                        baselineOccupied.countDown()
                        baselineRelease.await()
                    }
                }
                assertTrue(baselineOccupied.await(3, TimeUnit.SECONDS))
                Thread.ofVirtual().start {
                    Thread.sleep(300)
                    baselineRelease.countDown()
                }
                val baselineStarted = System.nanoTime()
                repeat(8) { baseline.execute {} }
                val baselineMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - baselineStarted)
                println("Executor submit benchmark (8 extra tasks): blocking=${baselineMillis}ms, rejecting=${submitMillis}ms")
            } finally {
                baselineRelease.countDown()
            }
        } finally {
            release.countDown()
        }
    }
}
