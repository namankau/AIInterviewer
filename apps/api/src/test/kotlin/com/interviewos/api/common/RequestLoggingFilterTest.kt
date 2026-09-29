package com.interviewos.api.common

import jakarta.servlet.FilterChain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.slf4j.MDC
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import java.util.UUID

class RequestLoggingFilterTest {
    private val filter = RequestLoggingFilter()

    @AfterEach
    fun clearMdc() {
        MDC.clear()
    }

    @Test
    fun `echoes a safe caller request id and exposes it during the request`() {
        val request = MockHttpServletRequest("GET", "/api/v1/health")
        request.addHeader("X-Request-ID", "support-case_42")
        val response = MockHttpServletResponse()
        var downstreamRequestId: String? = null

        filter.doFilter(
            request,
            response,
            FilterChain { _, _ -> downstreamRequestId = MDC.get("request_id") },
        )

        assertEquals("support-case_42", downstreamRequestId)
        assertEquals("support-case_42", response.getHeader("X-Request-ID"))
        assertEquals(null, MDC.get("request_id"))
    }

    @Test
    fun `replaces an unsafe request id with a uuid`() {
        val request = MockHttpServletRequest("GET", "/api/v1/health")
        request.addHeader("X-Request-ID", "contains spaces and personal data@example.com")
        val response = MockHttpServletResponse()

        filter.doFilter(request, response, FilterChain { _, _ -> })

        val generated = response.getHeader("X-Request-ID")
        assertNotEquals(request.getHeader("X-Request-ID"), generated)
        assertTrue(generated != null && UUID.fromString(generated).toString() == generated)
    }

    @Test
    fun `restores an existing request id after the request`() {
        MDC.put("request_id", "outer-request")
        val request = MockHttpServletRequest("GET", "/api/v1/health")
        val response = MockHttpServletResponse()

        filter.doFilter(request, response, FilterChain { _, _ -> })

        assertEquals("outer-request", MDC.get("request_id"))
    }
}
