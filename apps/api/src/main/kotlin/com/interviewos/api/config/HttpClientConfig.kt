package com.interviewos.api.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.net.http.HttpClient
import java.time.Duration

/**
 * Outbound HTTP for the API's own calls — Gemini and Supabase Storage.
 *
 * Spring Boot does not contribute a `RestClient.Builder` here, so it is defined
 * explicitly rather than by pulling in another starter for one bean. Built on the JDK's
 * own HTTP client, so there is no third dependency either.
 *
 * The read timeout is generous on purpose: composing a report over a full transcript is
 * a slow call, and timing it out would throw away an interview the candidate has already
 * sat through. Connecting is not slow, so that timeout stays short.
 */
@Configuration
class HttpClientConfig {
    @Bean
    fun restClientBuilder(): RestClient.Builder {
        val httpClient =
            HttpClient
                .newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build()

        val requestFactory =
            JdkClientHttpRequestFactory(httpClient).apply {
                setReadTimeout(Duration.ofMinutes(3))
            }

        return RestClient.builder().requestFactory(requestFactory)
    }
}
