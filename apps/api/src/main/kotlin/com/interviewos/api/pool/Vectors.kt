package com.interviewos.api.pool

import kotlin.math.sqrt

/**
 * The small amount of vector arithmetic the pool does for itself.
 *
 * Deliberately not a library. Two operations over a float array is not a dependency, and
 * the database does the rest when it is asked to.
 */
object Vectors {
    /**
     * Cosine similarity, in −1..1. Zero for a zero-length vector on either side, because
     * the angle between a vector and nothing is not defined and returning 1 there would
     * make every question a duplicate of an unembedded one.
     */
    fun cosine(
        a: FloatArray,
        b: FloatArray,
    ): Double {
        require(a.size == b.size) { "Cannot compare a ${a.size}-dimension vector with a ${b.size}-dimension one." }
        var dot = 0.0
        var aSquared = 0.0
        var bSquared = 0.0
        for (i in a.indices) {
            dot += a[i].toDouble() * b[i].toDouble()
            aSquared += a[i].toDouble() * a[i].toDouble()
            bSquared += b[i].toDouble() * b[i].toDouble()
        }
        if (aSquared == 0.0 || bSquared == 0.0) return 0.0
        return dot / (sqrt(aSquared) * sqrt(bSquared))
    }

    /**
     * Unit length, or the vector unchanged if it has no length to normalise.
     *
     * Applied on the way into the database. Cosine similarity does not need it — it
     * divides the magnitudes out — but a truncated Matryoshka embedding is no longer unit
     * length, and storing them normalised means inner product and cosine agree on the
     * stored column. Anything added later that reaches for the faster operator then gets
     * the same answer as this does.
     */
    fun normalise(vector: FloatArray): FloatArray {
        var squared = 0.0
        for (value in vector) squared += value.toDouble() * value.toDouble()
        if (squared == 0.0) return vector
        val length = sqrt(squared)
        return FloatArray(vector.size) { i -> (vector[i] / length).toFloat() }
    }
}
