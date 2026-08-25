package com.interviewos.api.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "interviewos.web")
data class WebProperties(
    val allowedOrigins: List<String> = emptyList(),
)
