import type { ProfileLanguage, RelocationIntent } from "./domain.js";

/** Error envelope returned by every non-2xx response from the API. */
export interface ApiError {
  error: string;
  message: string;
}

/** `GET /api/health` — unauthenticated, reports which build is running. */
export interface HealthResponse {
  status: "ok";
  name: string | null;
  version: string | null;
  builtAt: string | null;
}

export interface CompensationBand {
  min: number | null;
  max: number | null;
  /** ISO-4217 code. */
  currency: string | null;
}

/** PRD 05, "Context and constraints" and "Function and level". */
export interface ProfileResponse {
  function: string | null;
  currentLevel: string | null;
  targetLevel: string | null;
  totalExperienceMonths: number | null;
  peopleManagementScope: string | null;
  location: string | null;
  relocationIntent: RelocationIntent | null;
  workAuthorisationStatus: string | null;
  noticePeriodDays: number | null;
  compensationExpectation: CompensationBand | null;
}

/**
 * `GET /api/v1/me` — the signed-in candidate.
 *
 * There is no list of target employers here by design. Company and role are named at
 * the start of each session, and progress is derived by grouping completed sessions.
 */
export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  preferredLanguage: ProfileLanguage;
  /** ISO-8601 instant. */
  createdAt: string;
  profile: ProfileResponse;
}
