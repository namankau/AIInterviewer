package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageProperties
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.springframework.http.HttpStatus
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * The rules that matter here are all about what is left behind.
 *
 * A deletion that removes the rows and leaves the audio has told the candidate something
 * untrue, and a candidate who can reach another candidate's round has been handed
 * somebody else's interview. Both are tested against the calls actually made, not against
 * a return value.
 */
class RoundDeletionTest {
    private val userId: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val otherUserId: UUID = UUID.fromString("11111111-2222-3333-4444-555555555555")
    private val sessionId: UUID = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    private val storageProperties =
        StorageProperties(
            supabaseUrl = "https://project.supabase.co",
            serviceRoleKey = "service-role",
            mediaBucket = "interview-media",
        )

    // -- candidate-initiated deletion -----------------------------------------

    @Test
    fun `deleting a round removes the row and the recordings under it`() {
        val repository = mock(SessionRepository::class.java)
        given(repository.enqueueAndDeleteSession(sessionId, userId, "interview-media", "$userId/$sessionId")).willReturn(true)

        deletion(repository).delete(userId, sessionId)

        verify(repository).enqueueAndDeleteSession(sessionId, userId, "interview-media", "$userId/$sessionId")
    }

    /**
     * The auth-failure case, and it is a 404 rather than a 403 on purpose: telling a
     * caller that a session exists but is not theirs is itself a leak (`AdminAccess`
     * spells out the same reasoning for the source library).
     *
     * The important assertion is the second one. A round that did not delete must not have
     * its recordings purged, because the prefix that would be purged is built from the
     * *caller's* id and the requested session — and the day somebody changes this method to
     * purge before checking, this test is what stops one candidate deleting another's
     * audio by guessing a session id.
     */
    @Test
    fun `a round belonging to somebody else is a 404 and no durable job is created`() {
        val repository = mock(SessionRepository::class.java)
        given(
            repository.enqueueAndDeleteSession(
                sessionId,
                otherUserId,
                "interview-media",
                "$otherUserId/$sessionId",
            ),
        ).willReturn(false)

        val failure =
            assertFailsWith<ApiException> {
                deletion(repository).delete(otherUserId, sessionId)
            }

        assertEquals(HttpStatus.NOT_FOUND, failure.status)
        assertEquals("not_found", failure.code)
    }

    @Test
    fun `a storage failure is durably rescheduled after the session row is gone`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        val now = Instant.parse("2026-09-23T10:00:00Z")
        val jobId = UUID.fromString("78384af7-6042-45b3-a9fd-f2bf592d8e93")
        val job =
            StorageDeletionJobRow(
                jobId,
                "interview-media",
                "$userId/$sessionId",
                attempts = 1,
                settleAfter = now.plus(Duration.ofMinutes(15)),
            )
        given(repository.enqueueAndDeleteSession(sessionId, userId, "interview-media", "$userId/$sessionId")).willReturn(true)
        deletion(repository).delete(userId, sessionId)
        given(repository.claimStorageDeletionJobs(now, now.plus(Duration.ofMinutes(2)), 100)).willReturn(listOf(job))
        willThrow(ObjectStorageException("bucket unreachable"))
            .given(storage)
            .deleteByPrefix("interview-media", "$userId/$sessionId")

        StorageDeletionWorker(repository, storage).processDue(now)

        verify(storage).deleteByPrefix("interview-media", "$userId/$sessionId")
        verify(repository).markStorageDeletionFailed(jobId, "bucket unreachable", now.plusSeconds(30), now)
        verify(repository, never()).markStorageDeletionSucceeded(jobId, now, true)
    }

    @Test
    fun `an early successful purge stays pending for a final post-upload sweep`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        val now = Instant.parse("2026-09-23T10:00:00Z")
        val jobId = UUID.fromString("78384af7-6042-45b3-a9fd-f2bf592d8e93")
        given(repository.claimStorageDeletionJobs(now, now.plus(Duration.ofMinutes(2)), 100)).willReturn(
            listOf(
                StorageDeletionJobRow(
                    jobId,
                    "interview-media",
                    "$userId/$sessionId",
                    attempts = 1,
                    settleAfter = now.plus(Duration.ofMinutes(15)),
                ),
            ),
        )

        StorageDeletionWorker(repository, storage).processDue(now)

        verify(storage).deleteByPrefix("interview-media", "$userId/$sessionId")
        verify(repository).markStorageDeletionSucceeded(jobId, now, false)
    }

    @Test
    fun `a purge after the settling window completes the durable job`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        val now = Instant.parse("2026-09-23T10:20:00Z")
        val jobId = UUID.fromString("78384af7-6042-45b3-a9fd-f2bf592d8e93")
        given(repository.claimStorageDeletionJobs(now, now.plus(Duration.ofMinutes(2)), 100)).willReturn(
            listOf(
                StorageDeletionJobRow(
                    jobId,
                    "interview-media",
                    "$userId/$sessionId",
                    attempts = 2,
                    settleAfter = Instant.parse("2026-09-23T10:15:00Z"),
                ),
            ),
        )

        StorageDeletionWorker(repository, storage).processDue(now)

        verify(storage).deleteByPrefix("interview-media", "$userId/$sessionId")
        verify(repository).markStorageDeletionSucceeded(jobId, now, true)
    }

    // -- retention ------------------------------------------------------------

    @Test
    fun `expiry clears the report and the recordings but keeps the session row`() {
        val repository = mock(SessionRepository::class.java)
        val now = Instant.parse("2026-10-06T00:00:00Z")
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-09-08T00:00:00Z"), 200))
            .willReturn(listOf(ExpiringRound(sessionId, userId)))
        given(repository.enqueueAndExpireRound(sessionId, userId, "interview-media", "$userId/$sessionId")).willReturn(true)

        val cleared = deletion(repository).expireDueRounds(now)

        assertEquals(1, cleared)
        verify(repository).enqueueAndExpireRound(sessionId, userId, "interview-media", "$userId/$sessionId")
        // The round stays in the candidate's history. Progress is derived from completed
        // sessions, so deleting the row would tell them they never sat it.
        verify(repository, never()).enqueueAndDeleteSession(sessionId, userId, "interview-media", "$userId/$sessionId")
    }

    @Test
    fun `nothing due means no durable job is created`() {
        val repository = mock(SessionRepository::class.java)
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-09-08T00:00:00Z"), 200))
            .willReturn(emptyList())

        assertEquals(0, deletion(repository).expireDueRounds(Instant.parse("2026-10-06T00:00:00Z")))
    }

    /**
     * One unreachable object must not hold up retention for everybody queued behind it.
     * The failed round keeps its null `report_expired_at`, so it is still due and the next
     * pass tries it again; the count returned is what actually got cleared, not what was
     * attempted.
     */
    @Test
    fun `one round failing does not stop the rest of the sweep`() {
        val repository = mock(SessionRepository::class.java)
        val secondSession = UUID.fromString("9f9d1a3e-5c44-4b7a-8a11-70f2e1c9d004")
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-09-08T00:00:00Z"), 200))
            .willReturn(listOf(ExpiringRound(sessionId, userId), ExpiringRound(secondSession, userId)))
        given(repository.enqueueAndExpireRound(sessionId, userId, "interview-media", "$userId/$sessionId"))
            .willThrow(IllegalStateException("connection lost"))
        given(repository.enqueueAndExpireRound(secondSession, userId, "interview-media", "$userId/$secondSession"))
            .willReturn(true)

        val cleared = deletion(repository).expireDueRounds(Instant.parse("2026-10-06T00:00:00Z"))

        assertEquals(1, cleared)
    }

    @Test
    fun `the configured window decides what is due`() {
        val repository = mock(SessionRepository::class.java)
        val ninetyDays = RetentionProperties(reportsKeptFor = Duration.ofDays(90), batchSize = 50)
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-07-08T00:00:00Z"), 50))
            .willReturn(emptyList())

        RoundDeletion(repository, storageProperties, ninetyDays)
            .expireDueRounds(Instant.parse("2026-10-06T00:00:00Z"))

        verify(repository).listRoundsDueForExpiry(Instant.parse("2026-07-08T00:00:00Z"), 50)
    }

    private fun deletion(repository: SessionRepository) = RoundDeletion(repository, storageProperties, RetentionProperties())
}
