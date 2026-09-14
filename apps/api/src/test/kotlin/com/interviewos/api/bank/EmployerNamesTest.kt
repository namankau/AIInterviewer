package com.interviewos.api.bank

import com.interviewos.api.interview.Archetype
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EmployerNamesTest {
    private fun company(
        name: String,
        vararg aliases: String,
    ) = Company(UUID.randomUUID(), EmployerNames.slugFor(name), name, aliases.toList(), Archetype.GLOBAL_PRODUCT)

    @Test
    fun `a group of employers is not an employer`() {
        listOf("FAANG", "faang companies", "FAANG+", "MAANG", "Big Tech", "Big 4", "product-based companies", "MNCs", "startups")
            .forEach { assertFalse(EmployerNames.isNamedEmployer(it), it) }
    }

    @Test
    fun `a real employer is, including ones with punctuation in the name`() {
        listOf("Amazon", "Google Cloud India", "J.P. Morgan", "Bain & Company", "Booking.com", "N26")
            .forEach { assertTrue(EmployerNames.isNamedEmployer(it), it) }
    }

    @Test
    fun `a sentence or nothing is not a name`() {
        assertFalse(EmployerNames.isNamedEmployer(null))
        assertFalse(EmployerNames.isNamedEmployer("   "))
        assertFalse(EmployerNames.isNamedEmployer("a".repeat(EmployerNames.MAX_LENGTH + 1)))
    }

    @Test
    fun `resolution is exact, with only case and spacing ignored`() {
        val google = company("Google", "google llc")
        assertEquals(google, EmployerNames.pick(EmployerNames.lookupKey("  GOOGLE "), listOf(google)))
        assertEquals(google, EmployerNames.pick(EmployerNames.lookupKey("Google   LLC"), listOf(google)))
        // The directory never offers Google as a candidate for this; and if it somehow did,
        // a name that is neither its name nor an alias is still not a match.
        assertNull(EmployerNames.pick(EmployerNames.lookupKey("Google Cloud India"), listOf(google)))
    }

    @Test
    fun `an alias finds the employer it belongs to`() {
        val meta = company("Meta", "facebook", "meta platforms")
        assertEquals(meta, EmployerNames.pick("facebook", listOf(meta)))
    }

    @Test
    fun `a name match beats an alias, and a shared alias resolves to nobody`() {
        val real = company("Acme")
        val other = company("Acme Holdings", "acme")
        assertEquals(real, EmployerNames.pick("acme", listOf(other, real)))

        val a = company("Alpha", "shared")
        val b = company("Beta", "shared")
        assertNull(EmployerNames.pick("shared", listOf(a, b)))
    }

    @Test
    fun `slugs are url-safe and fold accents`() {
        assertEquals("booking-com", EmployerNames.slugFor("Booking.com"))
        assertEquals("societe-generale", EmployerNames.slugFor("Société  Générale"))
        assertEquals("bain-company", EmployerNames.slugFor("Bain & Company"))
        assertTrue(EmployerNames.slugFor("टाटा").matches(Regex("company-[0-9a-f]{8}")))
    }

    /** The backfill in the migration applies the same deny-list; the two must not drift. */
    @Test
    fun `the migration's backfill rejects exactly the same groups`() {
        assertEquals(EmployerNames.GROUPS, QuestionBankMigration.literals(QuestionBankMigration.block("employer-groups")))
        assertEquals(
            EmployerNames.GROUP_WORDS,
            QuestionBankMigration.literals(QuestionBankMigration.block("employer-group-words")),
        )
    }
}
