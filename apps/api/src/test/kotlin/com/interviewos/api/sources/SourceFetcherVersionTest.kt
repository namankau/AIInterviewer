package com.interviewos.api.sources

import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * A source read by an older extractor has to be read again even when its page has not
 * changed — otherwise everything read before a change to the extractor keeps the old shape
 * for ever, and the bank never fills from the library it already has.
 */
class SourceFetcherVersionTest {
    private fun source(
        hash: String?,
        version: Int,
    ) = SourceRow(
        id = UUID.randomUUID(),
        kind = "link",
        url = "https://example.com",
        storageBucket = null,
        storagePath = null,
        title = null,
        publisher = null,
        publishedOn = null,
        companyName = "Amazon",
        origin = null,
        status = "fetched",
        lastFetchedAt = null,
        fetchError = null,
        contentHash = hash,
        extractorVersion = version,
        questionCount = 0,
    )

    @Test
    fun `an unchanged page read by the current extractor is not sent to the model again`() {
        assertFalse(SourceFetcher.needsExtraction(source("abc", SourceFetcher.EXTRACTOR_VERSION), "abc"))
    }

    @Test
    fun `an unchanged page read by an older extractor is`() {
        assertTrue(SourceFetcher.needsExtraction(source("abc", SourceFetcher.EXTRACTOR_VERSION - 1), "abc"))
    }

    @Test
    fun `a changed page always is`() {
        assertTrue(SourceFetcher.needsExtraction(source("abc", SourceFetcher.EXTRACTOR_VERSION), "def"))
    }
}
