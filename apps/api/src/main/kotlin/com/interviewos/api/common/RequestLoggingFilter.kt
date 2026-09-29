package com.interviewos.api.common

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.slf4j.MDC
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.util.UUID
import java.util.concurrent.TimeUnit

/** Adds one safe correlation id to every response and every server log for the request. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestLoggingFilter : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val requestId = request.getHeader(REQUEST_ID_HEADER)?.takeIf(VALID_REQUEST_ID::matches) ?: UUID.randomUUID().toString()
        val previousRequestId = MDC.get(REQUEST_ID_MDC_KEY)
        val startedAt = System.nanoTime()

        MDC.put(REQUEST_ID_MDC_KEY, requestId)
        response.setHeader(REQUEST_ID_HEADER, requestId)
        try {
            filterChain.doFilter(request, response)
        } finally {
            log
                .atInfo()
                .addKeyValue("event", "http_request_completed")
                .addKeyValue("request_method", request.method)
                .addKeyValue("request_path", request.requestURI)
                .addKeyValue("status", response.status)
                .addKeyValue("duration_ms", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt))
                .log("HTTP request completed")
            if (previousRequestId == null) {
                MDC.remove(REQUEST_ID_MDC_KEY)
            } else {
                MDC.put(REQUEST_ID_MDC_KEY, previousRequestId)
            }
        }
    }

    private companion object {
        const val REQUEST_ID_HEADER = "X-Request-ID"
        const val REQUEST_ID_MDC_KEY = "request_id"
        val VALID_REQUEST_ID = Regex("[A-Za-z0-9._-]{1,64}")
    }
}
