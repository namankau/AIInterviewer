package com.interviewos.api.user

import com.interviewos.api.account.AccountDeletion
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * First endpoint of the versioned public API. The web app and, in Phase 3, the mobile
 * apps consume this same route — nothing here is coupled to server rendering.
 */
@RestController
@RequestMapping("/api/v1")
class MeController(
    private val userService: UserService,
    private val accountDeletion: AccountDeletion,
) {
    @GetMapping("/me")
    fun me(
        @AuthenticationPrincipal jwt: Jwt,
    ): MeResponse = userService.loadProfile(SupabaseIdentity.from(jwt))

    /**
     * Deletes the caller's account: every round, report, recording, resume and photo, and
     * the sign-in. The only account this can name is the token's own subject.
     */
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteAccount(
        @AuthenticationPrincipal jwt: Jwt,
    ) = accountDeletion.delete(SupabaseIdentity.from(jwt).id)
}
