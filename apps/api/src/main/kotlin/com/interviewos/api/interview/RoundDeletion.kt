package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
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
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val retention: RetentionProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Deletes one of the caller's own rounds: the session, its turns, its report and its
     * recordings.
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
        if (!repository.deleteSession(sessionId, userId)) {
            throw ApiException.notFound()
        }
        purgeRecordings(userId, sessionId, "deleted")
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
                repository.expireRound(round.sessionId, round.userId)
                purgeRecordings(round.userId, round.sessionId, "expired")
                cleared++
            } catch (e: RuntimeException) {
                // Logged and stepped over. The round keeps its null `report_expired_at`,
                // so it is still in the due list and the next pass tries it again.
                log.error("Could not expire round {}", round.sessionId, e)
            }
        }

        log.info("Cleared {} round(s) past the {}-day retention window", cleared, retention.days)
        return cleared
    }

    /**
     * Removes every recording belonging to one round.
     *
     * By prefix rather than by the paths on the turn rows, and that is not laziness. Media
     * is keyed `{userId}/{sessionId}/...` (`InterviewService.storeOrWarn`), so the prefix
     * is exactly this round and can reach nothing else — while the recorded paths only
     * cover uploads whose database write also succeeded. An upload that landed and then
     * lost its row is precisely the object nobody would ever come looking for again.
     *
     * The rows are gone by the time this runs, so a storage failure cannot be retried by
     * the candidate and must not be swallowed either. It is logged at error with the
     * prefix in it, because what is left behind is somebody's voice in a bucket after they
     * were told it had been deleted, and somebody has to be able to find it.
     */
    private fun purgeRecordings(
        userId: UUID,
        sessionId: UUID,
        what: String,
    ) {
        try {
            storage.deleteByPrefix(storageProperties.mediaBucket, "$userId/$sessionId")
        } catch (e: ObjectStorageException) {
            log.error(
                "Round {} was {} but its recordings remain at {}/{}/{}",
                sessionId,
                what,
                storageProperties.mediaBucket,
                userId,
                sessionId,
                e,
            )
        }
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
