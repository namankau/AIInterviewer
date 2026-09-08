package com.interviewos.api

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@ConfigurationPropertiesScan
// The source library re-reads itself on a timer (SourceRefreshJob). Without this the
// @Scheduled annotation is decoration and the corpus quietly goes stale.
@EnableScheduling
class ApiApplication

fun main(args: Array<String>) {
    runApplication<ApiApplication>(*args)
}
