package com.interviewos.api.config

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.ECDSASigner
import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.gen.ECKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.security.oauth2.jwt.JwtException
import java.net.InetSocketAddress
import java.time.Instant
import java.util.Date
import kotlin.test.assertEquals

/**
 * Exercises the decoder against a JWKS served over HTTP, the way it works in
 * production.
 *
 * This exists because of a real defect: `NimbusJwtDecoder.withJwkSetUri` accepts RS256
 * only unless told otherwise, and Supabase signs with an elliptic-curve key — so every
 * genuine token was rejected with a plain 401. Nothing short of decoding a real
 * ES256-signed token catches that.
 */
class SupabaseJwtDecoderTest {
    companion object {
        private lateinit var server: HttpServer
        private lateinit var signingKey: ECKey
        private lateinit var properties: SupabaseAuthProperties

        @JvmStatic
        @BeforeAll
        fun startJwksServer() {
            signingKey = ECKeyGenerator(Curve.P_256).keyID("test-signing-key").generate()

            server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
            val body = JWKSet(signingKey.toPublicJWK()).toString().toByteArray()
            server.createContext("/auth/v1/.well-known/jwks.json") { exchange ->
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(200, body.size.toLong())
                exchange.responseBody.use { it.write(body) }
            }
            server.start()

            properties = SupabaseAuthProperties(supabaseUrl = "http://127.0.0.1:${server.address.port}")
        }

        @JvmStatic
        @AfterAll
        fun stopJwksServer() {
            server.stop(0)
        }
    }

    private val decoder = SecurityConfig().jwtDecoder(properties)

    @Test
    fun `accepts an ES256 token signed with the project key`() {
        val jwt = decoder.decode(token())

        assertEquals("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11", jwt.subject)
        assertEquals("candidate@example.com", jwt.getClaimAsString("email"))
    }

    @Test
    fun `rejects a token signed with a key the project does not publish`() {
        val otherKey = ECKeyGenerator(Curve.P_256).keyID("test-signing-key").generate()

        assertThrows<JwtException> { decoder.decode(token(key = otherKey)) }
    }

    @Test
    fun `rejects a token issued for a different audience`() {
        assertThrows<JwtException> { decoder.decode(token(audience = "service_role")) }
    }

    @Test
    fun `rejects a token issued by a different Supabase project`() {
        assertThrows<JwtException> { decoder.decode(token(issuer = "https://someone-else.supabase.co/auth/v1")) }
    }

    @Test
    fun `rejects an expired token`() {
        val expiry = Instant.now().minusSeconds(60)

        assertThrows<JwtException> { decoder.decode(token(expiresAt = expiry)) }
    }

    private fun token(
        key: ECKey = signingKey,
        issuer: String = properties.issuer,
        audience: String = "authenticated",
        expiresAt: Instant = Instant.now().plusSeconds(3600),
    ): String {
        val claims =
            JWTClaimsSet
                .Builder()
                .issuer(issuer)
                .audience(audience)
                .subject("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
                .claim("email", "candidate@example.com")
                .claim("role", "authenticated")
                .issueTime(Date.from(Instant.now().minusSeconds(30)))
                .expirationTime(Date.from(expiresAt))
                .build()

        return SignedJWT(JWSHeader.Builder(JWSAlgorithm.ES256).keyID(key.keyID).build(), claims)
            .apply { sign(ECDSASigner(key)) }
            .serialize()
    }
}
