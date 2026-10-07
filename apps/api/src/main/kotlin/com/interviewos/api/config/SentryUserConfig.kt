package com.interviewos.api.config

import io.sentry.protocol.User
import io.sentry.spring7.SentryUserProvider
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt

/**
 * Tags a Sentry event with the account it happened to — by id only.
 *
 * The id is what lets an error be matched to a candidate's report of it, and it is a
 * random UUID that means nothing outside our database. Email and name stay out:
 * `send-default-pii` is off, and this provider deliberately sets nothing else.
 */
@Configuration
class SentryUserConfig {
    @Bean
    fun sentryAccountIdProvider(): SentryUserProvider =
        SentryUserProvider {
            val subject = (SecurityContextHolder.getContext().authentication?.principal as? Jwt)?.subject
            subject?.let { User().apply { id = it } }
        }
}
