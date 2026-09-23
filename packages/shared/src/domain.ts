/**
 * Closed vocabularies shared by the API and its clients. Each mirrors a Postgres enum
 * declared in `apps/api/src/main/resources/db/migration/V1__initial_schema.sql`, so
 * the two must be changed together.
 *
 * Open sets that a taxonomy will own later — function, level, company name — are
 * plain strings here and `text` in the database, deliberately.
 */

/** Languages an interview session can actively run in during Phase 1. */
export const INTERVIEW_LANGUAGES = ["english", "hindi_english"] as const;
export type InterviewLanguage = (typeof INTERVIEW_LANGUAGES)[number];

/** Profile preference keeps `regional` reserved without claiming sessions support it yet. */
export const PROFILE_LANGUAGES = [...INTERVIEW_LANGUAGES, "regional"] as const;
export type ProfileLanguage = (typeof PROFILE_LANGUAGES)[number];

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

/**
 * What a candidate says about their own stage when starting a session (task 051), so
 * they can correct the server's guess rather than sit whatever round it derived from
 * the role title and resume alone (`CandidateStage.of` on the API).
 *
 * A `text` column with a check constraint on the API side, not a real Postgres enum —
 * kept here anyway, unlike `level`, because unlike level this is a closed, candidate-
 * facing choice with exactly three options rather than an open field.
 */
export const CANDIDATE_STAGES = ["student", "recent_graduate", "professional"] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

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
