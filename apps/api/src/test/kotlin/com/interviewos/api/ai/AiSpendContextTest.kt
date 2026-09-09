package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

/**
 * Attribution has one job it must never get wrong: charging one candidate's interview to
 * another. A missing session id costs an unattributed row; a stale one costs a wrong
 * answer to "what did this round cost", which is worse because it looks right.
 */
class AiSpendContextTest {
    private val user = UUID.randomUUID()
    private val session = UUID.randomUUID()

    @Test
    fun `a call inside a block knows which interview it belongs to`() {
        val seen = AiSpendContext.of(user, session) { AiSpendContext.current() }

        assertEquals(AiSpendContext.Attribution(user, session), seen)
    }

    @Test
    fun `nothing is attributed outside a block`() {
        AiSpendContext.of(user, session) { }

        assertNull(AiSpendContext.current())
    }

    /**
     * The path that matters most. A round failing over to the expensive model is a round
     * throwing exceptions, and attribution that leaked on the exception path would tag
     * the *next* candidate's calls with this one's session.
     */
    @Test
    fun `attribution is cleared even when the call it wrapped throws`() {
        assertFailsWith<AiUnavailableException> {
            AiSpendContext.of(user, session) { throw AiUnavailableException("over the spend cap") }
        }

        assertNull(AiSpendContext.current())
    }

    @Test
    fun `a nested block restores the outer interview rather than clearing it`() {
        val inner = UUID.randomUUID()

        val outerAfterwards =
            AiSpendContext.of(user, session) {
                AiSpendContext.of(user, inner) { AiSpendContext.current() }
                AiSpendContext.current()
            }

        assertEquals(session, outerAfterwards?.sessionId)
        assertNull(AiSpendContext.current())
    }

    /** Resume parsing has an owner but no round, and that is a real state, not a gap. */
    @Test
    fun `a call with an owner but no round is attributed to the owner`() {
        val seen = AiSpendContext.of(user, null) { AiSpendContext.current() }

        assertEquals(user, seen?.userId)
        assertNull(seen?.sessionId)
    }
}
