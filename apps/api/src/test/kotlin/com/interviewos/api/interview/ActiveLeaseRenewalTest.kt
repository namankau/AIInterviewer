package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import java.util.UUID

class ActiveLeaseRenewalTest {
    private val answerId = UUID.randomUUID()
    private val hintId = UUID.randomUUID()
    private val reportId = UUID.randomUUID()

    @Test
    fun `only work still held by this process is renewed`() {
        val repository = mock(SessionRepository::class.java)
        val renewal = ActiveLeaseRenewal(repository)
        val answer = renewal.holdAnswer(answerId)
        val hint = renewal.holdHint(hintId)
        val report = renewal.holdReport(reportId)

        renewal.renew()

        verify(repository).renewAnswerRequests(listOf(answerId), 60)
        verify(repository).renewHintRequests(listOf(hintId), 60)
        verify(repository).renewReportGenerations(listOf(reportId), 60)

        answer.close()
        hint.close()
        report.close()
        renewal.renew()

        verify(repository, times(1)).renewAnswerRequests(listOf(answerId), 60)
        verify(repository, times(1)).renewHintRequests(listOf(hintId), 60)
        verify(repository, times(1)).renewReportGenerations(listOf(reportId), 60)
    }

    @Test
    fun `one failed renewal does not stop another lease or future retries`() {
        val repository = mock(SessionRepository::class.java)
        val renewal = ActiveLeaseRenewal(repository)
        renewal.holdAnswer(answerId)
        renewal.holdReport(reportId)
        given(repository.renewAnswerRequests(listOf(answerId), 60)).willThrow(IllegalStateException("database unavailable"))

        renewal.renew()
        renewal.renew()

        verify(repository, times(2)).renewAnswerRequests(listOf(answerId), 60)
        verify(repository, times(2)).renewReportGenerations(listOf(reportId), 60)
    }
}
