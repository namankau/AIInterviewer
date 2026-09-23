package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * Destroying a round, on the candidate's word or on a timer.
 *
 * The two callers want different things and they are deliberately not the same operation:
 *
 * - **The candidate deleting a past round** wants it gone. The session row goes too, so it
 *   leaves their history, because they asked for it to and it is theirs.
 * - **Retention** wants the evidence gone but the fact kept. The report, the transcript
 *   and the recordings are cleared; the session row survives, stamped
 *   `report_expired_at`. Progress in this product is derived from completed sessions
 *   rather than declared (CLAUDE.md), so deleting the row would quietly rewrite how much
 *   practice somebody has done — four weeks after a round they would be told they had
 *   never sat it.
 *
 * What both share, and the reason they live in one class, is the part that is easy to get
 * wrong: the recordings. Rows are the visible half of a deletion and the audio is the half
 * that matters. `CLAUDE.md` is unambiguous — "account deletion must actually delete,
 * including storage objects" — and a deletion that clears a candidate's transcript while
 * leaving their voice in a bucket is worse than not offering deletion at all, because it
 * has told them something untrue.
 */
@Service
class RoundDeletion(
    private val repository: SessionRepository,
    private val storageProperties: StorageProperties,
    private val retention: RetentionProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Deletes one of the caller's own rounds and atomically records the durable job that
     * removes its recordings. The HTTP request can finish once that job exists; storage
     * cleanup continues independently and is retried until it succeeds.
     *
     * [userId] comes from the verified token and nowhere else. A session belonging to
     * somebody else does not delete and is reported as [ApiException.notFound] — not 403,
     * because confirming that a session exists but is not yours is itself a leak (see
     * `AdminAccess`). The same 404 covers a round already deleted, which makes a
     * double-submitted delete harmless rather than a 500.
     *
     * A round still in progress is deletable. There is no special case for it: the
     * candidate is entitled to abandon and destroy a round they are sitting, and the only
     * thing still writing to it is the background synthesis of the next question, whose
     * update finds no row and does nothing.
     */
    fun delete(
        userId: UUID,
        sessionId: UUID,
    ) {
        val prefix = "$userId/$sessionId"
        if (!repository.enqueueAndDeleteSession(sessionId, userId, storageProperties.mediaBucket, prefix)) {
            throw ApiException.notFound()
        }
    }

    /**
     * Clears every round past its retention window, and returns how many it cleared.
     *
     * Each round is its own unit of work. One candidate's storage failing must not stop
     * the sweep — the alternative is a single unreachable object holding up retention for
     * everybody behind it in the queue.
     */
    fun expireDueRounds(now: Instant): Int {
        val due = repository.listRoundsDueForExpiry(retention.cutoffAt(now), retention.batchSize)
        if (due.isEmpty()) return 0

        var cleared = 0
        due.forEach { round ->
            try {
                val prefix = "${round.userId}/${round.sessionId}"
                if (repository.enqueueAndExpireRound(round.sessionId, round.userId, storageProperties.mediaBucket, prefix)) {
                    cleared++
                }
            } catch (e: RuntimeException) {
                // Logged and stepped over. The round keeps its null `report_expired_at`,
                // so it is still in the due list and the next pass tries it again.
                log.error("Could not expire round {}", round.sessionId, e)
            }
        }

        log.info("Cleared {} round(s) past the {}-day retention window", cleared, retention.days)
        return cleared
    }
}

/** Processes durable storage cleanup independently of the rows that requested it. */
@Service
class StorageDeletionWorker(
    private val repository: SessionRepository,
    private val storage: ObjectStorage,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun processDue(now: Instant): Int {
        val jobs = repository.claimStorageDeletionJobs(now, now.plus(JOB_LEASE), JOB_BATCH_SIZE)
        jobs.forEach { job ->
            try {
                storage.deleteByPrefix(job.bucket, job.objectPrefix)
                val settled = !now.isBefore(job.settleAfter)
                if (!repository.markStorageDeletionSucceeded(job.id, now, settled)) {
                    log.warn("Storage deletion job {} lost its lease before completion", job.id)
                }
            } catch (e: RuntimeException) {
                val retryAt = now.plusSeconds(retryDelaySeconds(job.attempts))
                runCatching { repository.markStorageDeletionFailed(job.id, e.message ?: e.javaClass.simpleName, retryAt, now) }
                    .onFailure { log.error("Could not reschedule storage deletion job {}", job.id, it) }
                log.error("Could not delete storage prefix {}/{}; job {} will retry", job.bucket, job.objectPrefix, job.id, e)
            }
        }
        return jobs.size
    }

    private fun retryDelaySeconds(attempts: Int): Long {
        val multiplier = 1L shl (attempts - 1).coerceIn(0, 7)
        return (30L * multiplier).coerceAtMost(3600L)
    }

    private companion object {
        val JOB_LEASE: Duration = Duration.ofMinutes(2)
        const val JOB_BATCH_SIZE = 100
    }
}

/**
 * Runs retention on a timer, so nothing depends on anybody remembering.
 *
 * Shaped after `SourceRefreshJob`: a short initial delay so a restart loop does not sweep
 * on every boot, then a long fixed delay. Twice a day is frequent enough for a rule
 * measured in weeks, and the batch bounds each pass, so a deployment that has been down
 * catches up over a few of them rather than in one long sweep.
 */
@Component
class ReportRetentionJob(
    private val roundDeletion: RoundDeletion,
) {
    @Scheduled(initialDelayString = "PT5M", fixedDelayString = "PT12H")
    fun expire() {
        roundDeletion.expireDueRounds(Instant.now())
    }
}

@Component
class StorageDeletionRetryJob(
    private val worker: StorageDeletionWorker,
) {
    @Scheduled(initialDelayString = "PT10S", fixedDelayString = "PT1M")
    fun deleteDuePrefixes() {
        worker.processDue(Instant.now())
    }
}
