package com.interviewos.api.bank

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * The question bank, for signed-in candidates (PRD 04, 08).
 *
 * Authentication is the security config's default for every `/api/v1` route; there is deliberately
 * no `permitAll` for these routes. The bank is not candidate data, so nothing here is
 * scoped to the caller — but it is extracted third-party text, and whether that goes on
 * public pages is the owner's call, not this controller's.
 */
@RestController
@RequestMapping("/api/v1/question-bank")
class QuestionBankController(
    private val service: QuestionBankService,
) {
    @GetMapping("/companies")
    fun companies(): List<BankCompanyView> = service.companies()

    @GetMapping
    fun questions(
        @RequestParam company: String,
        @RequestParam(required = false) roundType: String?,
        @RequestParam(required = false, defaultValue = "20") limit: Int,
        @RequestParam(required = false, defaultValue = "0") offset: Int,
    ): BankQuestionPage = service.page(company, roundType, limit, offset)
}
