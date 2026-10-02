package com.interviewos.api.sources

import org.springframework.stereotype.Component
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URI
import java.net.UnknownHostException

/**
 * Whether a link points at the public internet, and not back into our own network.
 *
 * The source library fetches whatever URL an admin gives it, from inside our
 * infrastructure. Without this, a link to `http://169.254.169.254/` (the cloud metadata
 * service), `localhost` or a private address would have the server read something it can
 * reach and the internet cannot — server-side request forgery, with the admin
 * allow-list as the only thing in the way.
 *
 * Every address the name resolves to must be public, because the HTTP client may connect
 * to any of them. Redirects need no second check: the JDK client this app builds follows
 * none. What this cannot stop is DNS changing between this check and the connection; that
 * needs a resolver pinned into the client, and is worth doing before the library takes
 * links from anybody but the owner.
 */
object PublicAddress {
    fun isPublicUrl(
        url: String,
        resolve: (String) -> List<InetAddress> = { InetAddress.getAllByName(it).toList() },
    ): Boolean {
        val host =
            runCatching { URI(url).host }
                .getOrNull()
                ?.removePrefix("[")
                ?.removeSuffix("]")
                ?.takeIf { it.isNotBlank() }
                ?: return false
        val addresses =
            try {
                resolve(host)
            } catch (e: UnknownHostException) {
                return false
            }
        return addresses.isNotEmpty() && addresses.all(::isPublic)
    }

    fun isPublic(address: InetAddress): Boolean {
        if (address.isAnyLocalAddress ||
            address.isLoopbackAddress ||
            address.isLinkLocalAddress ||
            address.isSiteLocalAddress ||
            address.isMulticastAddress
        ) {
            return false
        }
        val bytes = address.address
        return when (address) {
            is Inet4Address -> isPublicV4(bytes)
            is Inet6Address -> isPublicV6(bytes)
            else -> false
        }
    }

    private fun isPublicV4(b: ByteArray): Boolean {
        val first = b[0].toInt() and 0xff
        val second = b[1].toInt() and 0xff
        return when {
            first == 0 -> false

            // "this network"
            first == 100 && second in 64..127 -> false

            // carrier-grade NAT, 100.64.0.0/10
            first == 192 && second == 0 && (b[2].toInt() and 0xff) == 0 -> false

            // IETF protocol assignments
            first >= 240 -> false

            // reserved and broadcast
            else -> true
        }
    }

    private fun isPublicV6(b: ByteArray): Boolean {
        val first = b[0].toInt() and 0xff
        // Unique local addresses, fc00::/7 — IPv6's private ranges.
        if (first and 0xfe == 0xfc) return false
        // IPv4-mapped (::ffff:a.b.c.d): judge the IPv4 address it carries.
        val mapped = (0..9).all { b[it].toInt() == 0 } && (b[10].toInt() and 0xff) == 0xff && (b[11].toInt() and 0xff) == 0xff
        if (mapped) return isPublic(InetAddress.getByAddress(b.copyOfRange(12, 16)))
        return true
    }
}

/** [PublicAddress] as a bean, so the controller and fetcher can be tested without DNS. */
@Component
class LinkAddressCheck {
    fun isPublic(url: String): Boolean = PublicAddress.isPublicUrl(url)
}
