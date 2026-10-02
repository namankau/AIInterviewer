package com.interviewos.api.resume

/**
 * Whether a file's first bytes agree with the type the browser declared.
 *
 * The `Content-Type` of an upload is the client's word for it. A file that claims to be a
 * PDF is stored, sent to the model as a PDF and offered back for download as one, so the
 * claim is checked against the bytes rather than taken on trust.
 */
object ResumeSignature {
    private val PDF = "%PDF-".toByteArray()
    private val ZIP = byteArrayOf(0x50, 0x4B, 0x03, 0x04) // .docx is a zip container
    private val OLE = byteArrayOf(0xD0.toByte(), 0xCF.toByte(), 0x11, 0xE0.toByte(), 0xA1.toByte(), 0xB1.toByte(), 0x1A, 0xE1.toByte())
    private const val TEXT_SNIFF_BYTES = 8_192

    fun matches(
        contentType: String,
        bytes: ByteArray,
    ): Boolean {
        val type = contentType.substringBefore(';').trim().lowercase()
        return when (type) {
            "application/pdf" -> bytes.startsWith(PDF)

            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> bytes.startsWith(ZIP)

            "application/msword" -> bytes.startsWith(OLE)

            // Plain text has no signature; a NUL byte is the clearest sign it is not text.
            "text/plain" -> bytes.asSequence().take(TEXT_SNIFF_BYTES).none { it == 0.toByte() }

            else -> false
        }
    }

    private fun ByteArray.startsWith(prefix: ByteArray): Boolean = size >= prefix.size && prefix.indices.all { this[it] == prefix[it] }
}
