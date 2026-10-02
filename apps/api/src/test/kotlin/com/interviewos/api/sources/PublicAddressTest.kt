package com.interviewos.api.sources

import org.junit.jupiter.api.Test
import java.net.InetAddress
import java.net.UnknownHostException
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** The source library must only ever read the public internet, never our own network. */
class PublicAddressTest {
    @Test
    fun `ordinary public addresses are allowed`() {
        assertTrue(PublicAddress.isPublic(ip("93.184.215.14")))
        assertTrue(PublicAddress.isPublic(ip("2606:4700:4700::1111")))
    }

    @Test
    fun `loopback, private, link-local and metadata addresses are refused`() {
        listOf(
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.5",
            "192.168.1.1",
            "169.254.169.254",
            "0.0.0.0",
            "100.64.0.1",
            "255.255.255.255",
            "::1",
            "fe80::1",
            "fd00::1",
            "::ffff:127.0.0.1",
            "::ffff:169.254.169.254",
        ).forEach { assertFalse(PublicAddress.isPublic(ip(it)), "$it should not be public") }
    }

    @Test
    fun `a name is public only if every address it resolves to is`() {
        val mixed = { _: String -> listOf(ip("93.184.215.14"), ip("10.0.0.1")) }
        val public = { _: String -> listOf(ip("93.184.215.14")) }

        assertFalse(PublicAddress.isPublicUrl("https://example.com/a", mixed))
        assertTrue(PublicAddress.isPublicUrl("https://example.com/a", public))
    }

    @Test
    fun `a name that does not resolve, or a link with no host, is refused`() {
        val unknown = { _: String -> throw UnknownHostException("nope") }

        assertFalse(PublicAddress.isPublicUrl("https://does-not-exist.invalid/", unknown))
        assertFalse(PublicAddress.isPublicUrl("https:///no-host", { listOf(ip("93.184.215.14")) }))
    }

    @Test
    fun `a literal address in the link is judged without a lookup`() {
        assertFalse(PublicAddress.isPublicUrl("http://169.254.169.254/latest/meta-data"))
        assertFalse(PublicAddress.isPublicUrl("http://[::1]:8080/"))
    }

    private fun ip(literal: String): InetAddress = InetAddress.getByName(literal)
}
