package com.interviewos.api.bank

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Whether candidates can browse the sourced question bank (task 042).
 *
 * @param browsable **false by default.** Off, the two list endpoints answer 404 and the web
 *   app hides `/questions`. It hides the browsing only: the bank stays in the backend and
 *   rounds keep asking from it, because a round reads the repository, not these endpoints.
 *   Bound to the same env var the web app reads, `NEXT_PUBLIC_QUESTION_BANK_BROWSABLE`, so
 *   one switch moves both and the nav can never link to a page the API refuses.
 */
@ConfigurationProperties(prefix = "interviewos.question-bank")
data class QuestionBankProperties(
    val browsable: Boolean = false,
)
