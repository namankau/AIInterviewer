package com.interviewos.api.loopbrief

import com.interviewos.api.bank.BankCitation
import com.interviewos.api.bank.SourceOrigin
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

class SourcedStageMergerTest {
    @Test
    fun `merges the same stage name from two sources into one, with both citations`() {
        val first = row("Bar Raiser", order = 3, citation = citation("Post A"))
        val second = row("bar raiser", order = null, citation = citation("Post B"))

        val merged = SourcedStageMerger.merge(listOf(first, second))

        assertThat(merged).hasSize(1)
        assertThat(merged.single().citations.map { it.title }).containsExactlyInAnyOrder("Post A", "Post B")
        assertThat(merged.single().order).isEqualTo(3)
    }

    @Test
    fun `keeps genuinely different stages separate and orders them`() {
        val onsite = row("Onsite", order = 2, citation = citation("Post A"))
        val screen = row("Recruiter screen", order = 1, citation = citation("Post A"))

        val merged = SourcedStageMerger.merge(listOf(onsite, screen))

        assertThat(merged.map { it.stageName }).containsExactly("Recruiter screen", "Onsite")
    }

    @Test
    fun `one source reporting the same stage twice is one citation`() {
        val sourceId = UUID.randomUUID()
        val first = row("Onsite", order = 1, citation = citation("Post A", sourceId))
        val second = row("Onsite", order = 1, citation = citation("Post A", sourceId))

        val merged = SourcedStageMerger.merge(listOf(first, second))

        assertThat(merged.single().citations).hasSize(1)
    }

    private fun row(
        name: String,
        order: Int?,
        citation: BankCitation,
    ) = SourceProcessStageRow(
        stageName = name,
        roleFamily = "Backend Engineer",
        stageOrder = order,
        format = null,
        durationMinutes = null,
        assesses = null,
        roundType = RoundType.SYSTEM_DESIGN,
        citation = citation,
    )

    private fun citation(
        title: String,
        sourceId: UUID = UUID.randomUUID(),
    ) = BankCitation(sourceId = sourceId, title = title, publisher = null, url = null, year = 2024, origin = SourceOrigin.AUTHOR)
}
