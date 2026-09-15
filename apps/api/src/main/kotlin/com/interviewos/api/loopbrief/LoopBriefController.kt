package com.interviewos.api.loopbrief

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * How a company interviews for a role, before the candidate commits to a round (PRD 04,
 * 08, 10). Authentication is the security config's default for every `/api/v1` route.
 */
@RestController
@RequestMapping("/api/v1/loop-brief")
class LoopBriefController(
    private val service: LoopBriefService,
) {
    @GetMapping
    fun brief(
        @RequestParam company: String,
        @RequestParam(required = false) role: String?,
        @RequestParam(required = false) level: String?,
    ): LoopBriefView = service.brief(company, role, level)
}
