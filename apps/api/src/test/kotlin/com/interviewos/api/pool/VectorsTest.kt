package com.interviewos.api.pool

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.data.Offset
import org.junit.jupiter.api.Test

class VectorsTest {
    @Test
    fun `identical directions are the same question however long the vectors are`() {
        val similarity = Vectors.cosine(floatArrayOf(1f, 2f, 3f), floatArrayOf(2f, 4f, 6f))

        assertThat(similarity).isCloseTo(1.0, Offset.offset(1e-6))
    }

    @Test
    fun `orthogonal vectors are unrelated`() {
        assertThat(Vectors.cosine(floatArrayOf(1f, 0f), floatArrayOf(0f, 1f))).isZero()
    }

    @Test
    fun `a zero vector is unrelated to everything rather than identical to it`() {
        // Returning 1 here would make every question a duplicate of an unembedded one and
        // quietly empty the pool.
        assertThat(Vectors.cosine(floatArrayOf(0f, 0f), floatArrayOf(1f, 1f))).isZero()
    }

    @Test
    fun `comparing different widths is a bug, not a low score`() {
        assertThatThrownBy { Vectors.cosine(floatArrayOf(1f), floatArrayOf(1f, 1f)) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `normalising gives unit length`() {
        val normalised = Vectors.normalise(floatArrayOf(3f, 4f))

        assertThat(normalised).containsExactly(0.6f, 0.8f)
    }

    @Test
    fun `a zero vector normalises to itself rather than to NaN`() {
        assertThat(Vectors.normalise(floatArrayOf(0f, 0f))).containsExactly(0f, 0f)
    }
}
