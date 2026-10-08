package com.interviewos.api.storage

import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.json.JsonCompareMode
import org.springframework.test.web.client.ExpectedCount.once
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import tools.jackson.databind.json.JsonMapper

/**
 * Supabase lists one folder level at a time. An account's prefix holds one folder per
 * round, so a delete that only removed the files it listed would leave every recording.
 */
class SupabaseObjectStorageDeleteTest {
    private val properties =
        StorageProperties(supabaseUrl = "https://project.supabase.co", serviceRoleKey = "service-role")
    private val base = "https://project.supabase.co/storage/v1"

    @Test
    fun `deletes files in the folder and walks into every sub-folder`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val storage = SupabaseObjectStorage(properties, JsonMapper.builder().build(), builder)

        // The account folder: one loose file and one round's folder (no id).
        server
            .expect(once(), requestTo("$base/object/list/interview-media"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().json("""{"prefix":"u1"}""", JsonCompareMode.LENIENT))
            .andRespond(
                withSuccess(
                    """[{"name":"stray.webm","id":"a"},{"name":"s1","id":null}]""",
                    MediaType.APPLICATION_JSON,
                ),
            )
        server
            .expect(once(), requestTo("$base/object/interview-media"))
            .andExpect(method(HttpMethod.DELETE))
            .andExpect(content().json("""{"prefixes":["u1/stray.webm"]}"""))
            .andRespond(withSuccess())
        // Then the round's folder.
        server
            .expect(once(), requestTo("$base/object/list/interview-media"))
            .andExpect(content().json("""{"prefix":"u1/s1"}""", JsonCompareMode.LENIENT))
            .andRespond(
                withSuccess(
                    """[{"name":"turn-0-answer.webm","id":"b"},{"name":"turn-0-question.wav","id":"c"}]""",
                    MediaType.APPLICATION_JSON,
                ),
            )
        server
            .expect(once(), requestTo("$base/object/interview-media"))
            .andExpect(method(HttpMethod.DELETE))
            .andExpect(content().json("""{"prefixes":["u1/s1/turn-0-answer.webm","u1/s1/turn-0-question.wav"]}"""))
            .andRespond(withSuccess())

        storage.deleteByPrefix("interview-media", "u1")

        server.verify()
    }

    @Test
    fun `sends no delete for an empty folder`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val storage = SupabaseObjectStorage(properties, JsonMapper.builder().build(), builder)

        server
            .expect(once(), requestTo("$base/object/list/resumes"))
            .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))

        storage.deleteByPrefix("resumes", "u1")

        server.verify()
    }
}
