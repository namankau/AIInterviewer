package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(UsageController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class UsageControllerHttpTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var repository: SessionRepository

    @Test
    fun `public usage route returns aggregate counts without rerunning them on each request`() {
        given(repository.usageCounts()).willReturn(UsageCounts(12, 8))

        repeat(2) {
            mockMvc
                .perform(get("/api/v1/usage"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.interviewsCompleted").value(12))
                .andExpect(jsonPath("$.reportsGenerated").value(8))
        }
        verify(repository, times(1)).usageCounts()
    }
}
