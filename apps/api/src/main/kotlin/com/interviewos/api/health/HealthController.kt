package com.interviewos.api.health

import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.info.BuildProperties
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class HealthResponse(
    val status: String,
    val name: String?,
    val version: String?,
    val builtAt: Instant?,
)

/**
 * Unauthenticated liveness check that also identifies which build is running, so a
 * deployed environment can be matched to a commit without shell access.
 */
@RestController
class HealthController(
    // Absent when the app runs without build-info.properties (e.g. straight from an IDE).
    buildProperties: ObjectProvider<BuildProperties>,
) {
    private val build: BuildProperties? = buildProperties.getIfAvailable()

    @GetMapping("/api/health")
    fun health(): HealthResponse =
        HealthResponse(
            status = "ok",
            name = build?.name,
            version = build?.version,
            builtAt = build?.time,
        )
}
