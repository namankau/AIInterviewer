package com.interviewos.api.arena

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.pool.anyArg
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyInt
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/** `/api/v1/me/arena` — XP, streak, badges and the spaced-repetition schedule. */
@WebMvcTest(ArenaController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class ArenaControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var repository: ArenaProgressRepository

    @MockitoBean
    private lateinit var userRepository: UserRepository

    @Test
    fun `returns the candidate's progress, with mastery derived from the cards`() {
        given(repository.counters(CANDIDATE)).willReturn(Counters(120, 3, 9, LocalDate.parse("2026-09-21")))
        given(repository.badges(CANDIDATE)).willReturn(listOf("streak-7"))
        given(repository.cards(CANDIDATE)).willReturn(listOf(card("a", mastered = true), card("b", mastered = false)))

        mockMvc
            .perform(get("/api/v1/me/arena").with(candidateToken()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.xp").value(120))
            .andExpect(jsonPath("$.streak.current").value(3))
            .andExpect(jsonPath("$.streak.longest").value(9))
            .andExpect(jsonPath("$.streak.lastActiveDate").value("2026-09-21"))
            .andExpect(jsonPath("$.badges[0]").value("streak-7"))
            .andExpect(jsonPath("$.cards.a.reps").value(2))
            .andExpect(jsonPath("$.masteredChallengeIds.length()").value(1))
            .andExpect(jsonPath("$.masteredChallengeIds[0]").value("a"))
    }

    @Test
    fun `an untouched candidate reads as zero rather than as an error`() {
        given(repository.counters(CANDIDATE)).willReturn(null)
        given(repository.badges(CANDIDATE)).willReturn(emptyList())
        given(repository.cards(CANDIDATE)).willReturn(emptyList())

        mockMvc
            .perform(get("/api/v1/me/arena").with(candidateToken()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.xp").value(0))
            .andExpect(jsonPath("$.streak.current").value(0))
            .andExpect(jsonPath("$.streak.lastActiveDate").doesNotExist())
    }

    @Test
    fun `a correct answer awards the server's XP, not an amount the client asked for`() {
        given(repository.addAnswer(CANDIDATE, 10, LocalDate.parse("2026-09-21")))
            .willReturn(Counters(10, 1, 1, LocalDate.parse("2026-09-21")))

        mockMvc
            .perform(
                post("/api/v1/me/arena/answers")
                    .with(candidateToken())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(answerBody(correct = true)),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.xp").value(10))
            .andExpect(jsonPath("$.streak.current").value(1))

        verify(repository).addAnswer(CANDIDATE, ArenaController.XP_PER_CORRECT, LocalDate.parse("2026-09-21"))
        verify(repository).upsertCard(CANDIDATE, card("mcq-java-one-abc", mastered = true))
    }

    @Test
    fun `a wrong answer still records the card and the streak, but awards no XP`() {
        given(repository.addAnswer(CANDIDATE, 0, LocalDate.parse("2026-09-21")))
            .willReturn(Counters(0, 1, 1, LocalDate.parse("2026-09-21")))

        mockMvc
            .perform(
                post("/api/v1/me/arena/answers")
                    .with(candidateToken())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(answerBody(correct = false)),
            ).andExpect(status().isOk)

        verify(repository).addAnswer(CANDIDATE, 0, LocalDate.parse("2026-09-21"))

        // Mastery is "answered correctly at least once", so a wrong answer must not set it.
        verify(repository).upsertCard(CANDIDATE, card("mcq-java-one-abc", mastered = false))
    }

    @Test
    fun `refuses a badge it does not define, rather than storing an arbitrary string`() {
        mockMvc
            .perform(
                post("/api/v1/me/arena/badges")
                    .with(candidateToken())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"badgeIds":["streak-7","grandmaster-of-everything"]}"""),
            ).andExpect(status().isBadRequest)

        verify(repository, never()).awardBadges(anyArg(), anyArg())
    }

    @Test
    fun `refuses a local date that is not a date`() {
        mockMvc
            .perform(
                post("/api/v1/me/arena/answers")
                    .with(candidateToken())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(answerBody(correct = true, localDate = "yesterday")),
            ).andExpect(status().isBadRequest)

        verify(repository, never()).addAnswer(anyArg(), anyInt(), anyArg())
    }

    @Test
    fun `refuses negative counters on import`() {
        mockMvc
            .perform(
                post("/api/v1/me/arena/import")
                    .with(candidateToken())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"xp":-5,"streakCurrent":0,"streakLongest":0,"cards":[]}"""),
            ).andExpect(status().isBadRequest)
    }

    @Test
    fun `import drops badges it does not define instead of failing the whole import`() {
        given(repository.counters(CANDIDATE)).willReturn(Counters(50, 1, 1, null))
        given(repository.badges(CANDIDATE)).willReturn(listOf("streak-7"))
        given(repository.cards(CANDIDATE)).willReturn(emptyList())

        mockMvc
            .perform(
                post("/api/v1/me/arena/import")
                    .with(candidateToken())
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"xp":50,"streakCurrent":1,"streakLongest":1,"badgeIds":["streak-7","nope"],"cards":[]}"""),
            ).andExpect(status().isOk)

        verify(repository).importProgress(CANDIDATE, 50, 1, 1, null, listOf("streak-7"), emptyList())
    }

    @Test
    fun `rejects every route with no token`() {
        mockMvc.perform(get("/api/v1/me/arena")).andExpect(status().isUnauthorized)
        mockMvc
            .perform(
                post("/api/v1/me/arena/answers")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(answerBody(correct = true)),
            ).andExpect(status().isUnauthorized)
        mockMvc
            .perform(
                post("/api/v1/me/arena/import")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"cards":[]}"""),
            ).andExpect(status().isUnauthorized)

        verifyNoInteractions(repository)
    }

    private fun answerBody(
        correct: Boolean,
        localDate: String = "2026-09-21",
    ) = """
        {
          "challengeId": "mcq-java-one-abc",
          "correct": $correct,
          "localDate": "$localDate",
          "card": {
            "due": "2026-09-22T10:00:00Z",
            "stability": 3.5,
            "difficulty": 5.1,
            "scheduledDays": 1,
            "learningSteps": 0,
            "reps": 2,
            "lapses": 0,
            "state": 2,
            "lastReview": "2026-09-21T10:00:00Z"
          }
        }
        """.trimIndent()

    private fun card(
        id: String,
        mastered: Boolean,
    ) = StoredCard(
        challengeId = id,
        due = Instant.parse("2026-09-22T10:00:00Z"),
        stability = 3.5,
        difficulty = 5.1,
        scheduledDays = 1,
        learningSteps = 0,
        reps = 2,
        lapses = 0,
        state = 2,
        lastReview = Instant.parse("2026-09-21T10:00:00Z"),
        mastered = mastered,
    )

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
