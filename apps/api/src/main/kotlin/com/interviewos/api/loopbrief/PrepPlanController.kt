package com.interviewos.api.loopbrief

import com.interviewos.api.user.SupabaseIdentity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * The practice plan: an ordered list of rounds tied to the loop brief, the candidate's
 * own resume, and their history with this exact company and role (PRD 05, 09, 10).
 *
 * A separate endpoint from `/loop-brief` on purpose — the brief renders without waiting
 * on the candidate's own data.
 */
@RestController
@RequestMapping("/api/v1/prep-plan")
class PrepPlanController(
    private val service: PrepPlanService,
) {
    @GetMapping
    fun plan(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam company: String,
        @RequestParam(required = false) role: String?,
        @RequestParam(required = false) level: String?,
    ): PrepPlanView = service.plan(SupabaseIdentity.from(jwt).id, company, role, level)
}
