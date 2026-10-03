package com.interviewos.api.ai

import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.net.http.HttpClient
import java.time.Duration

/**
 * A shorter wait for the calls a candidate sits in silence through, on a provider that has
 * somebody behind it.
 *
 * Every outbound call shares one read timeout, and it is three minutes, set for the report:
 * composing one over a full transcript is slow, and cutting it off throws away a round the
 * candidate has already sat. The same three minutes applied to assessing an answer, so a
 * cheap model that stopped responding held the candidate in front of "Listening to your
 * answer…" for up to three minutes before the chain moved on to the model behind it. A
 * Gemini latency tail is not hypothetical here: one speech chunk was measured coming back
 * at 34.7 seconds (see [SpeechChunks]).
 *
 * The deadline is a property of the provider, not of the call, because what it buys
 * depends on where the provider sits. The first model in the chain can be cut off early
 * because a stronger one is waiting behind it, and a timeout there costs a fall-through,
 * not the round. The last capable model is left on the long timeout: cutting that one
 * short does not fall back, it stops the interview.
 */
object InRoomDeadline {
    /** Connecting is not where the time goes; never let it eat the whole deadline. */
    private val CONNECT_TIMEOUT: Duration = Duration.ofSeconds(10)

    /** A client like [builder]'s, whose calls give up after [readTimeout]. */
    fun client(
        builder: RestClient.Builder,
        readTimeout: Duration,
    ): RestClient {
        val http =
            HttpClient
                .newBuilder()
                .connectTimeout(minOf(CONNECT_TIMEOUT, readTimeout))
                .build()
        val factory = JdkClientHttpRequestFactory(http).apply { setReadTimeout(readTimeout) }
        return builder.clone().requestFactory(factory).build()
    }
}
