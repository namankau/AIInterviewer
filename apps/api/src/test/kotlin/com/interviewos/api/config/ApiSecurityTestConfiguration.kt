package com.interviewos.api.config

import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.test.context.TestConfiguration

/**
 * `@ConfigurationPropertiesScan` is not active in an MVC slice, so the properties
 * [SecurityConfig] depends on are bound explicitly from `src/test/resources/application.yml`.
 *
 * The JWKS URL there is never fetched: [org.springframework.security.oauth2.jwt.NimbusJwtDecoder]
 * resolves keys lazily, and these tests authenticate with a pre-built token rather
 * than decoding one.
 */
@TestConfiguration
@EnableConfigurationProperties(SupabaseAuthProperties::class, WebProperties::class)
class ApiSecurityTestConfiguration
