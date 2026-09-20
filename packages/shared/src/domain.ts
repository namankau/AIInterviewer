/**
 * Closed vocabularies shared by the API and its clients. Each mirrors a Postgres enum
 * declared in `apps/api/src/main/resources/db/migration/V1__initial_schema.sql`, so
 * the two must be changed together.
 *
 * Open sets that a taxonomy will own later — function, level, company name — are
 * plain strings here and `text` in the database, deliberately.
 */

/** PRD 05. `regional` is reserved; only English and Hindi-English ship in Phase 1. */
export const INTERVIEW_LANGUAGES = ["english", "hindi_english", "regional"] as const;
export type InterviewLanguage = (typeof INTERVIEW_LANGUAGES)[number];

/** PRD 03. Determines round structure and evaluation criteria for a session. */
export const EMPLOYER_ARCHETYPES = [
  "global_product",
  "indian_product",
  "service_based_it",
  "consulting_big_four",
  "european_employer",
  "gcc_captive",
  "regulated_professional",
  "industrial_manufacturing",
] as const;
export type EmployerArchetype = (typeof EMPLOYER_ARCHETYPES)[number];

/** PRD 06. */
export const ROUND_TYPES = [
  "aptitude",
  "technical_fundamentals",
  "project_deep_dive",
  "coding_practical",
  "system_design",
  "case_client_scenario",
  "techno_managerial",
  "behavioural_competency",
  "hr_fit_closing",
] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

export const SESSION_STATUSES = ["created", "in_progress", "completed", "abandoned", "failed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const RESUME_PARSE_STATUSES = ["pending", "processing", "parsed", "failed"] as const;
export type ResumeParseStatus = (typeof RESUME_PARSE_STATUSES)[number];

export const RELOCATION_INTENTS = ["not_open", "open_within_country", "open_internationally"] as const;
export type RelocationIntent = (typeof RELOCATION_INTENTS)[number];
