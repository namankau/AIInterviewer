package com.interviewos.api.user

import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * First endpoint of the versioned public API. The web app and, in Phase 3, the mobile
 * apps consume this same route — nothing here is coupled to server rendering.
 */
@RestController
@RequestMapping("/api/v1")
class MeController(
    private val userService: UserService,
) {
    @GetMapping("/me")
    fun me(
        @AuthenticationPrincipal jwt: Jwt,
    ): MeResponse = userService.loadProfile(SupabaseIdentity.from(jwt))
}
