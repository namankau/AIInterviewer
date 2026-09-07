package com.interviewos.api.sources

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.SourceDocument
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.task.TaskExecutor
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.net.URI
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * Reads the source library and keeps the extracted questions current.
 *
 * **This is not a crawler, and the difference is enforced here rather than promised in a
 * comment.** `CLAUDE.md` puts bulk scraping of interview discussion sites out of scope by
 * decision, and every rule below exists to keep this on the right side of that line:
 *
 * - Only URLs somebody explicitly added are ever fetched. Nothing is discovered.
 * - **Links on a fetched page are never followed.** That single rule is the whole
 *   difference between reading a document and crawling a site.
 * - robots.txt is checked before each fetch, and a disallow is permanent: a blocked
 *   source is never retried on the refresh timer.
 * - One request at a time per host, with a real User-Agent that says who we are.
 * - A response that has not changed since the last read is not re-extracted, so a
 *   refresh costs one conditional read rather than a model call.
 */
@Component
class SourceFetcher(
    private val repository: SourceRepository,
    private val interviewAi: InterviewAi,
    private val storage: ObjectStorage,
    restClientBuilder: RestClient.Builder,
    @Qualifier("interviewBackgroundExecutor") private val executor: TaskExecutor,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val http = restClientBuilder.build()

    /** Reads one source now, on a background thread. Used when an operator adds one. */
    fun refreshSoon(id: UUID) {
        executor.execute {
            repository.list().firstOrNull { it.id == id }?.let { read(it) }
        }
    }

    /**
     * Reads one source and replaces its questions.
     *
     * Every failure is recorded on the row rather than thrown: the library is a
     * background concern, and one unreachable page must not stop the rest being read.
     */
    fun read(source: SourceRow) {
        try {
            val document = load(source) ?: return
            if (document.content.isBlank()) {
                repository.markFetched(source.id, SourceStatus.FAILED, null, "Nothing readable at that address.")
                return
            }

            val hash = sha256(document.content)
            if (hash == source.contentHash) {
                // Unchanged since the last read. Re-extracting would cost a model call to
                // arrive at the same rows.
                repository.markFetched(source.id, SourceStatus.FETCHED, hash, null)
                return
            }

            val extracted = interviewAi.extractQuestions(document)
            repository.replaceQuestions(source.id, extracted.value.questions)
            repository.markFetched(source.id, SourceStatus.FETCHED, hash, null)
            log.info(
                "Read source {} ({}): {} question(s)",
                source.id,
                source.url ?: source.storagePath,
                extracted.value.questions.size,
            )
        } catch (e: AiUnavailableException) {
            log.warn("Could not extract questions from source {}", source.id, e)
            // The model's own message, not a generic one: a spend cap and an outage need
            // different things from whoever reads this row.
            repository.markFetched(source.id, SourceStatus.FAILED, null, e.message?.take(300))
        } catch (e: RestClientException) {
            log.warn("Could not fetch source {}", source.id, e)
            repository.markFetched(source.id, SourceStatus.FAILED, null, e.message?.take(300))
        } catch (e: ObjectStorageException) {
            log.warn("Could not read stored document for source {}", source.id, e)
            repository.markFetched(source.id, SourceStatus.FAILED, null, e.message?.take(300))
        }
    }

    private fun load(source: SourceRow): SourceDocument? =
        when (source.kind) {
            "link" -> loadLink(source)
            "document" -> loadDocument(source)
            else -> null
        }

    private fun loadLink(source: SourceRow): SourceDocument? {
        val url = source.url ?: return null

        if (!robotsAllows(url)) {
            log.info("robots.txt disallows {}; not fetching it again", url)
            repository.markFetched(
                source.id,
                SourceStatus.BLOCKED,
                null,
                "This site's robots.txt asks us not to read that page, so we have not.",
            )
            return null
        }

        val body =
            http
                .get()
                .uri(URI(url))
                .header("User-Agent", USER_AGENT_HEADER)
                .header("Accept", "text/html,application/xhtml+xml,text/plain")
                .retrieve()
                .body(String::class.java)
                .orEmpty()

        return SourceDocument(
            title = source.title,
            publisher = source.publisher,
            companyName = source.companyName,
            url = url,
            content = readableText(body).take(MAX_CONTENT_CHARS),
        )
    }

    private fun loadDocument(source: SourceRow): SourceDocument? {
        val bucket = source.storageBucket ?: return null
        val path = source.storagePath ?: return null
        val bytes = storage.download(bucket, path)
        return SourceDocument(
            title = source.title,
            publisher = source.publisher,
            companyName = source.companyName,
            url = null,
            content = readableText(String(bytes, Charsets.UTF_8)).take(MAX_CONTENT_CHARS),
        )
    }

    /**
     * Whether the site allows this page to be read.
     *
     * A robots.txt that cannot be fetched allows everything, which is what the standard
     * says. A robots.txt that *can* be fetched and says no is final.
     */
    private fun robotsAllows(url: String): Boolean {
        val robotsUrl =
            try {
                val uri = URI(url)
                URI(uri.scheme, uri.authority, "/robots.txt", null, null).toString()
            } catch (e: IllegalArgumentException) {
                log.warn("Could not derive robots.txt for {}", url, e)
                return false
            }

        val robots =
            try {
                http
                    .get()
                    .uri(URI(robotsUrl))
                    .header("User-Agent", USER_AGENT_HEADER)
                    .retrieve()
                    .body(String::class.java)
                    .orEmpty()
            } catch (e: RestClientException) {
                // No robots.txt, or unreachable. The standard reads that as permission.
                ""
            }

        return RobotsRules.allows(robots, url)
    }

    /**
     * Tags out, text in.
     *
     * Deliberately crude: the extractor is a language model reading prose, so it wants
     * the words rather than a faithful DOM. Script and style contents are dropped whole
     * because their contents are not prose and would only waste the context.
     */
    private fun readableText(body: String): String =
        body
            .replace(SCRIPT_OR_STYLE, " ")
            .replace(TAG, " ")
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace(WHITESPACE, " ")
            .trim()

    private fun sha256(text: String): String =
        MessageDigest
            .getInstance("SHA-256")
            .digest(text.toByteArray())
            .joinToString("") { "%02x".format(it) }

    companion object {
        /** How long before a source is read again. */
        val REFRESH_AFTER: Duration = Duration.ofDays(7)

        /** Sources read per scheduled run, so a large library spreads over several. */
        const val BATCH_SIZE = 10

        /** Enough for a long article; a book-length page is truncated rather than refused. */
        const val MAX_CONTENT_CHARS = 120_000

        val USER_AGENT_HEADER =
            "${RobotsRules.USER_AGENT} (+https://acemyinterview.com/bot; curated source library, not a crawler)"

        private val SCRIPT_OR_STYLE = Regex("(?is)<(script|style)[^>]*>.*?</\\1>")
        private val TAG = Regex("(?s)<[^>]+>")
        private val WHITESPACE = Regex("\\s+")
    }
}

/**
 * Re-reads the library on a timer, so questions stay current without anyone remembering.
 *
 * Batched and spread out rather than fetching everything at once: this is somebody
 * else's server, and a burst of requests from us is rude whatever robots.txt permits.
 */
@Component
class SourceRefreshJob(
    private val repository: SourceRepository,
    private val fetcher: SourceFetcher,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @org.springframework.scheduling.annotation.Scheduled(
        initialDelayString = "PT2M",
        fixedDelayString = "PT6H",
    )
    fun refresh() {
        val due = repository.due(Instant.now().minus(SourceFetcher.REFRESH_AFTER), SourceFetcher.BATCH_SIZE)
        if (due.isEmpty()) return

        log.info("Refreshing {} source(s) from the library", due.size)
        // One at a time on purpose. These are other people's servers.
        due.forEach(fetcher::read)
    }
}
