package com.interviewos.api.common

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.AuthenticationException
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * Single error envelope for the public API. Web and, later, the mobile clients parse
 * one shape, so failures never need client-specific handling.
 */
data class ApiError(
    val error: String,
    val message: String,
)

/**
 * Renders [ApiError] for the two failures Spring Security handles before any
 * controller runs: missing/invalid token, and a valid token without the required
 * authority.
 */
@Component
class ApiErrorWriter(
    private val objectMapper: ObjectMapper,
) : AuthenticationEntryPoint,
    AccessDeniedHandler {
    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException,
    ) = write(response, HttpStatus.UNAUTHORIZED, "unauthorized", "A valid Supabase access token is required.")

    override fun handle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        accessDeniedException: AccessDeniedException,
    ) = write(response, HttpStatus.FORBIDDEN, "forbidden", "This token is not permitted to access that resource.")

    private fun write(
        response: HttpServletResponse,
        status: HttpStatus,
        error: String,
        message: String,
    ) {
        if (response.isCommitted) return
        response.status = status.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        objectMapper.writeValue(response.writer, ApiError(error, message))
    }
}
