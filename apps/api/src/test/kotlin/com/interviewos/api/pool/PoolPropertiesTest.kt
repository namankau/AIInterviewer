package com.interviewos.api.pool

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner

class PoolPropertiesTest {
    @Test
    fun `generation is off unless somebody turns it on`() {
        // The default this task ships in, and the one CLAUDE.md rule 7 asks for: a run can
        // be planned and read, and nothing is spent until the owner says so.
        assertThat(PoolProperties().enabled).isFalse()
    }

    @Test
    fun `the embedding width matches the column the migration creates`() {
        // `pool_questions.embedding` is `vector(768)`. Asking the model for any other width
        // makes every insert fail, and it fails in the middle of a paid-for run rather than
        // at startup, so the two are pinned together here.
        assertThat(PoolProperties().embeddingDimensions).isEqualTo(768)
    }

    @Test
    fun `every key in application yml actually binds`() {
        // A property name that does not bind is invisible: the default quietly applies, and
        // a spend cap or a rate limit nobody set is exactly the setting that matters.
        ApplicationContextRunner()
            .withConfiguration(
                org.springframework.boot.autoconfigure.AutoConfigurations.of(
                    ConfigurationPropertiesAutoConfiguration::class.java,
                ),
            ).withUserConfiguration(PoolPropertiesConfiguration::class.java)
            .withPropertyValues(
                "interviewos.pool.enabled=true",
                "interviewos.pool.requests-per-minute=7",
                "interviewos.pool.concurrency=3",
                "interviewos.pool.questions-per-cell=9",
                "interviewos.pool.duplicate-similarity=0.87",
                "interviewos.pool.default-spend-cap-micro-usd=123456",
                "interviewos.pool.call-headroom-micro-usd=654",
                "interviewos.pool.embedding-model=some-embedding-model",
                "interviewos.pool.embedding-dimensions=1536",
                "interviewos.pool.max-attempts-per-cell=5",
            ).run { context ->
                val properties = context.getBean(PoolProperties::class.java)
                assertThat(properties.enabled).isTrue()
                assertThat(properties.requestsPerMinute).isEqualTo(7)
                assertThat(properties.concurrency).isEqualTo(3)
                assertThat(properties.questionsPerCell).isEqualTo(9)
                assertThat(properties.duplicateSimilarity).isEqualTo(0.87)
                assertThat(properties.defaultSpendCapMicroUsd).isEqualTo(123_456)
                assertThat(properties.callHeadroomMicroUsd).isEqualTo(654)
                assertThat(properties.embeddingModel).isEqualTo("some-embedding-model")
                assertThat(properties.embeddingDimensions).isEqualTo(1536)
                assertThat(properties.maxAttemptsPerCell).isEqualTo(5)
            }
    }

    @Test
    fun `a rate limit of zero is refused rather than silently stalling the job`() {
        assertThatThrownBy { PoolProperties(requestsPerMinute = 0) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `a similarity threshold outside zero to one is refused`() {
        assertThatThrownBy { PoolProperties(duplicateSimilarity = 1.5) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }
}

@org.springframework.boot.context.properties.EnableConfigurationProperties(PoolProperties::class)
private class PoolPropertiesConfiguration
