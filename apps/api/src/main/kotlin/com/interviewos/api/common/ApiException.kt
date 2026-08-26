package com.interviewos.api.common

import org.springframework.http.HttpStatus

/**
 * A failure a controller or service raises deliberately, carrying the status and the
 * error code the client sees. [ApiExceptionHandler] renders it as the one [ApiError]
 * envelope the whole public API uses.
 *
 * Ownership failures are reported as [notFound], never as 403: telling a caller that a
 * resource exists but is not theirs is itself a leak. A resource that is not yours is,
 * as far as you are concerned, not there.
 */
class ApiException(
    val status: HttpStatus,
    val code: String,
    override val message: String,
) : RuntimeException(message) {
    companion object {
        fun notFound(message: String = "That resource does not exist.") = ApiException(HttpStatus.NOT_FOUND, "not_found", message)

        fun badRequest(
            message: String,
            code: String = "bad_request",
        ) = ApiException(HttpStatus.BAD_REQUEST, code, message)

        fun conflict(
            message: String,
            code: String = "conflict",
        ) = ApiException(HttpStatus.CONFLICT, code, message)

        fun paymentRequired(message: String) = ApiException(HttpStatus.PAYMENT_REQUIRED, "payment_required", message)

        fun unprocessable(
            message: String,
            code: String = "unprocessable",
        ) = ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message)

        fun upstreamUnavailable(message: String) = ApiException(HttpStatus.SERVICE_UNAVAILABLE, "upstream_unavailable", message)
    }
}
