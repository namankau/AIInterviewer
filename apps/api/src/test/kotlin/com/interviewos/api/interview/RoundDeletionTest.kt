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
        val storage = mock(ObjectStorage::class.java)
        given(repository.deleteSession(sessionId, userId)).willReturn(true)

        deletion(repository, storage).delete(userId, sessionId)

        verify(repository).deleteSession(sessionId, userId)
        // Media is keyed {userId}/{sessionId}/..., so the prefix is exactly this round.
        verify(storage).deleteByPrefix("interview-media", "$userId/$sessionId")
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
    fun `a round belonging to somebody else is a 404 and nothing is touched`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        given(repository.deleteSession(sessionId, otherUserId)).willReturn(false)

        val failure =
            assertFailsWith<ApiException> {
                deletion(repository, storage).delete(otherUserId, sessionId)
            }

        assertEquals(HttpStatus.NOT_FOUND, failure.status)
        assertEquals("not_found", failure.code)
        verify(storage, never()).deleteByPrefix("interview-media", "$otherUserId/$sessionId")
    }

    /**
     * The row is already gone by the time storage is asked, so there is nothing to roll
     * back and nothing the candidate could usefully retry. Failing the request now would
     * tell them the deletion did not happen when most of it did. It is logged loudly
     * instead — a stranded recording is a data-protection problem, and somebody has to be
     * able to find it.
     */
    @Test
    fun `a storage failure does not turn a completed deletion into an error`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        given(repository.deleteSession(sessionId, userId)).willReturn(true)
        willThrow(ObjectStorageException("bucket unreachable"))
            .given(storage)
            .deleteByPrefix("interview-media", "$userId/$sessionId")

        deletion(repository, storage).delete(userId, sessionId)

        verify(storage).deleteByPrefix("interview-media", "$userId/$sessionId")
    }

    // -- retention ------------------------------------------------------------

    @Test
    fun `expiry clears the report and the recordings but keeps the session row`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        val now = Instant.parse("2026-10-06T00:00:00Z")
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-09-08T00:00:00Z"), 200))
            .willReturn(listOf(ExpiringRound(sessionId, userId)))

        val cleared = deletion(repository, storage).expireDueRounds(now)

        assertEquals(1, cleared)
        verify(repository).expireRound(sessionId, userId)
        verify(storage).deleteByPrefix("interview-media", "$userId/$sessionId")
        // The round stays in the candidate's history. Progress is derived from completed
        // sessions, so deleting the row would tell them they never sat it.
        verify(repository, never()).deleteSession(sessionId, userId)
    }

    @Test
    fun `nothing due means nothing is asked of storage`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-09-08T00:00:00Z"), 200))
            .willReturn(emptyList())

        assertEquals(0, deletion(repository, storage).expireDueRounds(Instant.parse("2026-10-06T00:00:00Z")))

        verify(storage, never()).deleteByPrefix("interview-media", "$userId/$sessionId")
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
        val storage = mock(ObjectStorage::class.java)
        val secondSession = UUID.fromString("9f9d1a3e-5c44-4b7a-8a11-70f2e1c9d004")
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-09-08T00:00:00Z"), 200))
            .willReturn(listOf(ExpiringRound(sessionId, userId), ExpiringRound(secondSession, userId)))
        given(repository.expireRound(sessionId, userId)).willThrow(IllegalStateException("connection lost"))
        given(repository.expireRound(secondSession, userId)).willReturn(true)

        val cleared = deletion(repository, storage).expireDueRounds(Instant.parse("2026-10-06T00:00:00Z"))

        assertEquals(1, cleared)
        verify(storage, never()).deleteByPrefix("interview-media", "$userId/$sessionId")
        verify(storage).deleteByPrefix("interview-media", "$userId/$secondSession")
    }

    @Test
    fun `the configured window decides what is due`() {
        val repository = mock(SessionRepository::class.java)
        val storage = mock(ObjectStorage::class.java)
        val ninetyDays = RetentionProperties(reportsKeptFor = Duration.ofDays(90), batchSize = 50)
        given(repository.listRoundsDueForExpiry(Instant.parse("2026-07-08T00:00:00Z"), 50))
            .willReturn(emptyList())

        RoundDeletion(repository, storage, storageProperties, ninetyDays)
            .expireDueRounds(Instant.parse("2026-10-06T00:00:00Z"))

        verify(repository).listRoundsDueForExpiry(Instant.parse("2026-07-08T00:00:00Z"), 50)
    }

    private fun deletion(
        repository: SessionRepository,
        storage: ObjectStorage,
    ) = RoundDeletion(repository, storage, storageProperties, RetentionProperties())
}
