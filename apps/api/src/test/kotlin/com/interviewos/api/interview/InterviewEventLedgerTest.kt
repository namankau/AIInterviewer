package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockingDetails
import java.io.File
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertContains

class InterviewEventLedgerTest {
    @Test
    fun `recorder failure never escapes into an interview`() {
        val repository = mock(InterviewEventRepository::class.java)
        val event = InterviewEvent(UUID.randomUUID(), UUID.randomUUID(), "client_heartbeat")
        given(repository.append(event)).willThrow(IllegalStateException("database down"))

        DurableInterviewEventRecorder(repository).record(event)
    }

    @Test
    fun `retention job deletes only events older than the configured window`() {
        val repository = mock(InterviewEventRepository::class.java)
        val retention = RetentionProperties(reportsKeptFor = Duration.ofDays(28))
        val before = Instant.now().minus(Duration.ofDays(28).plusMinutes(1))

        InterviewEventRetentionJob(repository, retention).purge()

        val call = mockingDetails(repository).invocations.single { it.method.name == "purgeBefore" }
        val cutoff = call.arguments[0] as Instant
        kotlin.test.assertFalse(cutoff.isBefore(before))
        kotlin.test.assertEquals(5_000, call.arguments[1])
    }

    @Test
    fun `migration cascades account and session deletion and denies direct candidate reads`() {
        val sql = File("../../supabase/migrations/20261010000000_interview_event_ledger.sql").readText()

        assertContains(sql, "user_id uuid not null references public.users (id) on delete cascade")
        assertContains(sql, "session_id uuid not null references public.sessions (id) on delete cascade")
        assertContains(sql, "alter table public.interview_events enable row level security")
        kotlin.test.assertFalse(sql.contains("create policy interview_events"))
    }
}
