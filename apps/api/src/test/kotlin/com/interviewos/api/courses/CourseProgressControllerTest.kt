package com.interviewos.api.courses

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.pool.anyArg
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/** `/api/v1/me/course-progress` — chapter completion, owned by the account. */
@WebMvcTest(CourseProgressController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class CourseProgressControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var repository: CourseProgressRepository

    @MockitoBean
    private lateinit var userRepository: UserRepository

    @Test
    fun `returns the candidate's completed chapters grouped by course`() {
        given(repository.findAll(CANDIDATE)).willReturn(mapOf("java" to listOf("one", "two"), "dsa" to listOf("x")))

        mockMvc
            .perform(get("/api/v1/me/course-progress").with(candidateToken()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.completed.java[0]").value("one"))
            .andExpect(jsonPath("$.completed.java[1]").value("two"))
            .andExpect(jsonPath("$.completed.dsa[0]").value("x"))
    }

    @Test
    fun `marks a chapter complete for the candidate in the token, not one named by the caller`() {
        mockMvc
            .perform(put("/api/v1/me/course-progress/java/your-first-program").with(candidateToken()).with(csrf()))
            .andExpect(status().isNoContent)

        verify(repository).markComplete(CANDIDATE, "java", "your-first-program")
    }

    @Test
    fun `un-marks a chapter`() {
        mockMvc
            .perform(delete("/api/v1/me/course-progress/java/your-first-program").with(candidateToken()).with(csrf()))
            .andExpect(status().isNoContent)

        verify(repository).markIncomplete(CANDIDATE, "java", "your-first-program")
    }

    @Test
    fun `imports browser progress as a union and returns the merged result`() {
        given(repository.findAll(CANDIDATE)).willReturn(mapOf("java" to listOf("one", "two")))

        mockMvc
            .perform(
                post("/api/v1/me/course-progress/import")
                    .with(candidateToken())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"chapters":[{"courseSlug":"java","chapterSlug":"two"}]}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.completed.java[1]").value("two"))

        verify(repository).markAllComplete(CANDIDATE, listOf(CourseChapter("java", "two")))
    }

    @Test
    fun `rejects a slug that is not a slug, rather than passing it to a query`() {
        mockMvc
            .perform(put("/api/v1/me/course-progress/java/../../etc").with(candidateToken()).with(csrf()))
            .andExpect(status().is4xxClientError)

        verify(repository, never()).markComplete(anyArg(), anyArg(), anyArg())
    }

    @Test
    fun `rejects every route with no token`() {
        mockMvc.perform(get("/api/v1/me/course-progress")).andExpect(status().isUnauthorized)
        mockMvc
            .perform(put("/api/v1/me/course-progress/java/one").with(csrf()))
            .andExpect(status().isUnauthorized)
        mockMvc
            .perform(delete("/api/v1/me/course-progress/java/one").with(csrf()))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(repository)
    }

    private fun candidateToken() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(CANDIDATE.toString())
                .claim("email", "candidate@example.com")
        }

    private companion object {
        val CANDIDATE: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    }
}
