package com.interviewos.api.storage

/**
 * Private object storage for personal data — resumes, and interview audio and video.
 *
 * Objects are keyed as `{userId}/...` so ownership is the first path segment, matching
 * the storage RLS policies in the migration. The API uses the service role here (which
 * bypasses RLS); ownership is enforced by the callers from the verified JWT subject, and
 * by never handing one user a path under another user's prefix.
 */
interface ObjectStorage {
    fun upload(
        bucket: String,
        path: String,
        bytes: ByteArray,
        contentType: String,
    )

    fun download(
        bucket: String,
        path: String,
    ): ByteArray

    /** A short-lived URL the browser can use to play back a stored media object. */
    fun createSignedUrl(
        bucket: String,
        path: String,
        expiresInSeconds: Int,
    ): String

    /** Removes every object under a prefix. Used by account deletion (PRD 12). */
    fun deleteByPrefix(
        bucket: String,
        prefix: String,
    )
}

class ObjectStorageException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)
