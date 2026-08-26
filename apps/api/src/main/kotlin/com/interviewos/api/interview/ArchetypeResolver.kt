package com.interviewos.api.interview

import org.springframework.stereotype.Component
import java.util.Locale

/**
 * Resolves a company name the candidate typed into an employer archetype (PRD 03).
 *
 * The archetype decides round structure and evaluation emphasis. Where the employer is
 * not recognised, resolution falls back to an inferred archetype and says so — callers
 * surface that to the candidate. Never present an archetype-level pattern as a specific
 * claim about a real company's process; fabricated specificity is the most damaging
 * failure this product has (PRD 04).
 */
@Component
class ArchetypeResolver {
    fun resolve(companyName: String): ArchetypeResolution {
        val normalised = companyName.lowercase(Locale.ROOT).trim()
        if (normalised.isEmpty()) {
            return ArchetypeResolution(Archetype.GLOBAL_PRODUCT, Confidence.INFERRED)
        }

        val exact = KNOWN.entries.firstOrNull { (name, _) -> name == normalised }
        if (exact != null) {
            return ArchetypeResolution(exact.value, Confidence.RECOGNISED)
        }

        // "Google India", "Infosys BPM" — match on a whole word so "micro" does not
        // match "Microsoft" and drag a candidate into the wrong loop.
        val words = normalised.split(NON_WORD).filter { it.isNotBlank() }.toSet()
        val partial = KNOWN.entries.firstOrNull { (name, _) -> name in words }
        if (partial != null) {
            return ArchetypeResolution(partial.value, Confidence.RECOGNISED)
        }

        return ArchetypeResolution(inferFrom(normalised), Confidence.INFERRED)
    }

    /**
     * A weak signal from the name itself, used only to pick a starting archetype. It is
     * always reported as inferred, never as knowledge about the employer.
     */
    private fun inferFrom(normalised: String): Archetype =
        when {
            CONSULTING_HINTS.any { it in normalised } -> Archetype.CONSULTING_BIG_FOUR
            SERVICES_HINTS.any { it in normalised } -> Archetype.SERVICE_BASED_IT
            BANKING_HINTS.any { it in normalised } -> Archetype.REGULATED_PROFESSIONAL
            INDUSTRIAL_HINTS.any { it in normalised } -> Archetype.INDUSTRIAL_MANUFACTURING
            else -> Archetype.GLOBAL_PRODUCT
        }

    private companion object {
        val NON_WORD = Regex("[^a-z0-9]+")

        val CONSULTING_HINTS = listOf("consulting", "advisory", "partners", "associates")
        val SERVICES_HINTS = listOf("technologies", "infotech", "systems", "solutions", "services", "consultancy")
        val BANKING_HINTS = listOf("bank", "capital", "insurance", "chartered", "audit", "tax")
        val INDUSTRIAL_HINTS = listOf("motors", "steel", "industries", "manufacturing", "engineering", "automobile")

        /**
         * Representative employers per archetype from PRD §03. This is a routing table,
         * not a knowledge base — it says which *kind* of loop to run, and nothing about
         * any specific company's process.
         */
        val KNOWN: Map<String, Archetype> =
            buildMap {
                listOf("google", "amazon", "microsoft", "atlassian", "uber", "meta", "apple", "netflix", "adobe")
                    .forEach { put(it, Archetype.GLOBAL_PRODUCT) }
                listOf("zoho", "freshworks", "razorpay", "zerodha", "swiggy", "zomato", "flipkart", "paytm", "cred", "meesho")
                    .forEach { put(it, Archetype.INDIAN_PRODUCT) }
                listOf("tcs", "infosys", "wipro", "cognizant", "capgemini", "ltimindtree", "hcl", "techmahindra", "mphasis")
                    .forEach { put(it, Archetype.SERVICE_BASED_IT) }
                listOf("deloitte", "ey", "pwc", "kpmg", "accenture", "mckinsey", "bain", "bcg")
                    .forEach { put(it, Archetype.CONSULTING_BIG_FOUR) }
                listOf("booking", "adyen", "sap", "zalando", "n26", "revolut", "spotify", "klarna")
                    .forEach { put(it, Archetype.EUROPEAN_EMPLOYER) }
                listOf("goldman", "jpmorgan", "barclays", "hsbc", "optum", "walmart")
                    .forEach { put(it, Archetype.GCC_CAPTIVE) }
            }
    }
}

/** Mirrors the `employer_archetype` Postgres enum. */
enum class Archetype(
    val dbValue: String,
    val label: String,
    val roundEmphasis: String,
) {
    GLOBAL_PRODUCT(
        "global_product",
        "Global product company",
        "Coding, system design, and behavioural rounds against published leadership principles, with a bar raiser.",
    ),
    INDIAN_PRODUCT(
        "indian_product",
        "Indian product company or startup",
        "Practical coding, product sense, ownership scenarios, and often a founder round.",
    ),
    SERVICE_BASED_IT(
        "service_based_it",
        "Service-based IT firm",
        "Aptitude, technical fundamentals, a detailed project walkthrough, techno-managerial discussion, and HR fit.",
    ),
    CONSULTING_BIG_FOUR(
        "consulting_big_four",
        "Consulting or Big Four",
        "Case discussion, client-scenario handling, a manager round, and values and fit.",
    ),
    EUROPEAN_EMPLOYER(
        "european_employer",
        "European employer",
        "Structured competency rounds, culture and values fit, and a frank relocation and visa conversation.",
    ),
    GCC_CAPTIVE(
        "gcc_captive",
        "GCC or captive centre",
        "Domain depth, stakeholder management, and process and compliance awareness.",
    ),
    REGULATED_PROFESSIONAL(
        "regulated_professional",
        "Regulated or professional practice",
        "Technical statute knowledge, ethics and judgement scenarios, and fit for the practice.",
    ),
    INDUSTRIAL_MANUFACTURING(
        "industrial_manufacturing",
        "Industrial or manufacturing",
        "Core domain fundamentals, plant and process scenarios, and safety and quality reasoning.",
    ),
    ;

    companion object {
        fun fromDbValue(value: String): Archetype =
            entries.firstOrNull { it.dbValue == value }
                ?: throw IllegalArgumentException("Unknown archetype: $value")
    }
}

enum class Confidence(
    val dbValue: String,
) {
    /** The employer is in the routing table. Still no specific process claims. */
    RECOGNISED("recognised"),

    /** Archetype inferred. The UI must tell the candidate this is a general pattern. */
    INFERRED("inferred"),
}

data class ArchetypeResolution(
    val archetype: Archetype,
    val confidence: Confidence,
) {
    /**
     * Grounding handed to the model, and the basis of what the UI shows the candidate.
     * Phrased so the model cannot mistake a routing decision for employer knowledge.
     */
    val grounding: String
        get() =
            when (confidence) {
                Confidence.RECOGNISED -> {
                    "This employer runs a loop typical of: ${archetype.label}. " +
                        "Emphasis: ${archetype.roundEmphasis} " +
                        "You know the archetype, not this company's current internal process. " +
                        "Never state a specific fact about this company's hiring process."
                }

                Confidence.INFERRED -> {
                    "This employer is not known to us. Fall back to the archetype: ${archetype.label}. " +
                        "Emphasis: ${archetype.roundEmphasis} " +
                        "Say nothing specific about this company at all — you have no information about it."
                }
            }
}
