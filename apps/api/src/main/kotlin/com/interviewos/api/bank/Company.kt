package com.interviewos.api.bank

import com.interviewos.api.interview.Archetype
import java.util.UUID

/**
 * One employer in the directory.
 *
 * [aliases] are other exact names for the same employer, lower-cased — `facebook` for
 * Meta — and never a subsidiary, region or division. [archetype] is null unless somebody
 * decided it; callers fall back to `ArchetypeResolver`, which labels its answer inferred.
 */
data class Company(
    val id: UUID,
    val slug: String,
    val name: String,
    val aliases: List<String>,
    val archetype: Archetype?,
)

/**
 * The basis on which we may use a source, recorded against it and shown with every
 * citation. Mirrors the `source_origin` Postgres enum.
 *
 * It changes what a citation means to a candidate: an employer describing its own process
 * is a different kind of evidence from one person's account of their loop.
 */
enum class SourceOrigin(
    val dbValue: String,
) {
    /** The employer's own published page about how it hires. */
    EMPLOYER("employer"),

    /** An openly licensed repository or document. */
    OPEN_LICENCE("open_licence"),

    /** An individual's own post, used with attribution. */
    AUTHOR("author"),
    ;

    companion object {
        fun fromDbValue(value: String?): SourceOrigin? = entries.firstOrNull { it.dbValue == value }
    }
}
