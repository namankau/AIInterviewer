package com.interviewos.api.interview

import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler
import org.springframework.stereotype.Component
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** Renews only leases held by this process. A crash stops renewal without a startup reset. */
@Component
class ActiveLeaseRenewal(
    private val repository: SessionRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val answers = ConcurrentHashMap.newKeySet<UUID>()
    private val hints = ConcurrentHashMap.newKeySet<UUID>()
    private val reports = ConcurrentHashMap.newKeySet<UUID>()

    fun holdAnswer(requestId: UUID): AutoCloseable = hold(answers, requestId)

    fun holdHint(requestId: UUID): AutoCloseable = hold(hints, requestId)

    fun holdReport(leaseId: UUID): AutoCloseable = hold(reports, leaseId)

    private fun hold(
        active: MutableSet<UUID>,
        id: UUID,
    ): AutoCloseable {
        active.add(id)
        return AutoCloseable { active.remove(id) }
    }

    fun renew() {
        renewAnswers()
        renewHints()
        renewReports()
    }

    @Scheduled(initialDelayString = "PT20S", fixedDelayString = "PT20S", scheduler = "leaseRenewalScheduler")
    fun renewAnswers() = renewBatch("answer", answers, repository::renewAnswerRequests)

    @Scheduled(initialDelayString = "PT20S", fixedDelayString = "PT20S", scheduler = "leaseRenewalScheduler")
    fun renewHints() = renewBatch("hint", hints, repository::renewHintRequests)

    @Scheduled(initialDelayString = "PT20S", fixedDelayString = "PT20S", scheduler = "leaseRenewalScheduler")
    fun renewReports() = renewBatch("report", reports, repository::renewReportGenerations)

    private fun renewBatch(
        kind: String,
        active: Set<UUID>,
        renew: (List<UUID>, Long) -> Int,
    ) {
        active.toList().chunked(BATCH_SIZE).forEach { ids ->
            try {
                renew(ids, LEASE_SECONDS)
            } catch (e: RuntimeException) {
                log.error("Could not renew {} active {} lease(s)", ids.size, kind, e)
            }
        }
    }

    companion object {
        const val LEASE_SECONDS = 60L
        private const val BATCH_SIZE = 100
    }
}

/** Retention and other scheduled jobs must not delay a live worker's lease heartbeat. */
@Configuration
class LeaseRenewalScheduling {
    @Bean(name = ["leaseRenewalScheduler"])
    fun leaseRenewalScheduler(): ThreadPoolTaskScheduler =
        ThreadPoolTaskScheduler().apply {
            poolSize = 3
            setThreadNamePrefix("lease-renewal-")
        }
}
