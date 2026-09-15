package com.interviewos.api.pool

import org.mockito.ArgumentCaptor
import org.mockito.ArgumentMatchers

/**
 * Mockito's matchers, in a form Kotlin's null checks accept.
 *
 * `ArgumentMatchers.any()` and `ArgumentCaptor.capture()` both return null — the value is
 * irrelevant, because Mockito matches on a side-channel stack rather than on what is
 * passed. Kotlin does not know that, and inserts a null check on the way into any
 * non-nullable parameter, so the matcher blows up before the mock is ever reached.
 *
 * These register the matcher exactly as Mockito intends and then hand back a null through
 * an unchecked cast, which is the whole trick. Written here rather than pulling in
 * `mockito-kotlin`: it is nine lines against a new dependency (CLAUDE.md rule 6).
 */
@Suppress("UNCHECKED_CAST")
fun <T> anyArg(): T {
    ArgumentMatchers.any<T>()
    return null as T
}

/** [ArgumentMatchers.eq], returning the value itself so Kotlin has nothing to check. */
fun <T : Any> eqArg(value: T): T {
    ArgumentMatchers.eq(value)
    return value
}

@Suppress("UNCHECKED_CAST")
fun <T> captureArg(captor: ArgumentCaptor<T>): T {
    captor.capture()
    return null as T
}
