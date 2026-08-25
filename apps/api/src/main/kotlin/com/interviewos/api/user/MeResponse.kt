package com.interviewos.api.user

import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

/**
 * Response body of `GET /api/v1/me`. Mirrors the candidate profile model in PRD 05.
 *
 * Note what is absent: any list of target employers. Company and role are named per
 * session, and progress is derived by grouping completed sessions.
 */
data class MeResponse(
    val id: UUID,
    val email: String,
    val displayName: String?,
    val preferredLanguage: String,
    val createdAt: Instant,
    val profile: ProfileResponse,
)

data class ProfileResponse(
    val function: String?,
    val currentLevel: String?,
    val targetLevel: String?,
    val totalExperienceMonths: Int?,
    val peopleManagementScope: String?,
    val location: String?,
    val relocationIntent: String?,
    val workAuthorisationStatus: String?,
    val noticePeriodDays: Int?,
    val compensationExpectation: CompensationBand?,
)

data class CompensationBand(
    val min: BigDecimal?,
    val max: BigDecimal?,
    val currency: String?,
)
