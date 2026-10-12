package com.interviewos.api.config

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.web.method.HandlerMethod
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProductFeatureInterceptorTest {
    private val handler = HandlerMethod(TestHandler(), TestHandler::class.java.getDeclaredMethod("handle"))

    @Test
    fun `disabled feature paths answer not found`() {
        val interceptor =
            ProductFeatureInterceptor(
                ProductFeatureProperties(
                    mockInterviews = false,
                    courses = false,
                    arena = false,
                    reports = false,
                    questions = false,
                ),
            )

        for ((method, path) in gatedPaths) {
            val error =
                assertThrows<ApiException>("$method $path should be gated") {
                    interceptor.preHandle(request(method, path), MockHttpServletResponse(), handler)
                }
            assertEquals(HttpStatus.NOT_FOUND, error.status)
        }
    }

    @Test
    fun `enabled features and deletion routes remain available`() {
        val enabled = ProductFeatureInterceptor(ProductFeatureProperties(questions = true))
        for ((method, path) in gatedPaths) {
            assertTrue(enabled.preHandle(request(method, path), MockHttpServletResponse(), handler))
        }

        val allOff =
            ProductFeatureInterceptor(
                ProductFeatureProperties(false, false, false, false, false),
            )
        assertTrue(
            allOff.preHandle(
                request("DELETE", "/api/v1/sessions/86fcddf4-5e2b-4cab-b0c6-05e928d04529"),
                MockHttpServletResponse(),
                handler,
            ),
        )
    }

    private fun request(
        method: String,
        path: String,
    ) = MockHttpServletRequest(method, path)

    private val gatedPaths =
        listOf(
            "POST" to "/api/v1/sessions",
            "POST" to "/api/v1/sessions/86fcddf4-5e2b-4cab-b0c6-05e928d04529/begin",
            "GET" to "/api/v1/sessions",
            "GET" to "/api/v1/sessions/86fcddf4-5e2b-4cab-b0c6-05e928d04529/report",
            "GET" to "/api/v1/readiness",
            "GET" to "/api/v1/me/course-progress",
            "POST" to "/api/v1/me/arena/answers",
        )

    private class TestHandler {
        @Suppress("unused")
        fun handle() = Unit
    }
}
