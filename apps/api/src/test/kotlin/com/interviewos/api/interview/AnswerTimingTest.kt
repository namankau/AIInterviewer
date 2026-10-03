package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AnswerTimingTest {
    private val mapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()

    private fun parse(json: String?) = AnswerTiming.parse(json, mapper)

    @Test
    fun `reads a consistent measurement`() {
        val timing =
            parse(
                """{"recordedMs":30000,"firstSoundMs":1500,"speakingMs":24000,"pauseCount":2,"longestPauseMs":2500,"totalPauseMs":3700}""",
            )

        assertEquals(AnswerTiming(30_000, 1_500, 24_000, 2, 2_500, 3_700), timing)
    }

    @Test
    fun `an answer in which nothing was heard is still a measurement`() {
        val timing = parse("""{"recordedMs":8000,"firstSoundMs":null,"speakingMs":0,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}""")

        assertEquals(AnswerTiming(8_000, null, 0, 0, 0, 0), timing)
    }

    @Test
    fun `no timing, blank timing and malformed timing all read as not measured`() {
        assertNull(parse(null))
        assertNull(parse(""))
        assertNull(parse("not json"))
        assertNull(parse("""{"recordedMs":30000}"""))
    }

    @Test
    fun `numbers that cannot describe one answer are refused rather than shown`() {
        // Speech running past the end of the recording.
        assertNull(
            parse("""{"recordedMs":10000,"firstSoundMs":4000,"speakingMs":8000,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}"""),
        )
        // More time paused than spent speaking.
        assertNull(
            parse("""{"recordedMs":30000,"firstSoundMs":0,"speakingMs":5000,"pauseCount":3,"longestPauseMs":3000,"totalPauseMs":9000}"""),
        )
        // Pauses with nothing heard.
        assertNull(
            parse("""{"recordedMs":30000,"firstSoundMs":null,"speakingMs":0,"pauseCount":1,"longestPauseMs":1200,"totalPauseMs":1200}"""),
        )
        // A "pause" shorter than a pause.
        assertNull(
            parse("""{"recordedMs":30000,"firstSoundMs":0,"speakingMs":20000,"pauseCount":1,"longestPauseMs":400,"totalPauseMs":400}"""),
        )
        // Negative and empty recordings.
        assertNull(parse("""{"recordedMs":0,"firstSoundMs":null,"speakingMs":0,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}"""))
        assertNull(parse("""{"recordedMs":30000,"firstSoundMs":-5,"speakingMs":100,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}"""))
        // A longest pause longer than all the pauses together.
        assertNull(
            parse("""{"recordedMs":30000,"firstSoundMs":0,"speakingMs":20000,"pauseCount":2,"longestPauseMs":5000,"totalPauseMs":3000}"""),
        )
    }
}
