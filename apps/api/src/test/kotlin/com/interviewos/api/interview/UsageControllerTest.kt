package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals

class UsageControllerTest {
    private class MutableClock(
        var now: Instant,
    ) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId): Clock = this

        override fun instant(): Instant = now
    }

    @Test
    fun `reuses the aggregate for 60 seconds then reads fresh counts`() {
        val repository = mock(SessionRepository::class.java)
        val clock = MutableClock(Instant.parse("2026-10-15T00:00:00Z"))
        val first = UsageCounts(12, 8)
        val second = UsageCounts(13, 9)
        given(repository.usageCounts()).willReturn(first, second)
        val controller = UsageController(repository, clock)

        assertEquals(first, controller.usage())
        clock.now = clock.now.plusSeconds(59)
        assertEquals(first, controller.usage())
        clock.now = clock.now.plusSeconds(1)
        assertEquals(second, controller.usage())
        verify(repository, times(2)).usageCounts()
    }

    @Test
    fun `concurrent public requests share one table count`() {
        val repository = mock(SessionRepository::class.java)
        given(repository.usageCounts()).willAnswer {
            Thread.sleep(30)
            UsageCounts(12, 8)
        }
        val controller = UsageController(repository, Clock.systemUTC())
        val executor = Executors.newFixedThreadPool(8)
        val start = CountDownLatch(1)
        try {
            val requests =
                List(8) {
                    executor.submit<UsageCounts> {
                        start.await()
                        controller.usage()
                    }
                }
            start.countDown()
            requests.forEach { assertEquals(UsageCounts(12, 8), it.get(2, TimeUnit.SECONDS)) }
            verify(repository, times(1)).usageCounts()
        } finally {
            executor.shutdownNow()
        }
    }
}
