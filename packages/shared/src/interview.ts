import type { RoundType } from "./domain.js";

/** Whether the candidate may start another interview, and why not if not. */
export interface EntitlementView {
  allowed: boolean;
  reason: "allowed" | "session_in_progress" | "free_tier_exhausted";
  message: string;
  remainingFree: number;
}

export interface TurnView {
  turnIndex: number;
  questionText: string;
  /** Short-lived signed URL for the spoken question. Null until the voice has rendered. */
  questionAudioUrl: string | null;
  /**
   * Speech is synthesised after the question text is sent, so the room has to tell
   * "still coming" apart from "not coming": a null URL alone says only that there is
   * nothing to play yet. `unavailable` means the turn runs as written text.
   */
  questionAudioStatus: SpeechStatus;
  /** Where this exchange sits in the round. */
  phase: TurnPhase;
  answered: boolean;
}

export type SpeechStatus = "pending" | "ready" | "unavailable";

/**
 * A round warms up before it gets hard, and closes rather than stopping dead. The server
 * decides which stage a turn belongs to; the room only labels it.
 */
export type TurnPhase = "warmup" | "main" | "closing";

export interface SessionView {
  id: string;
  companyName: string;
  archetype: string;
  archetypeLabel: string;
  /**
   * `inferred` means we do not know this employer and are running general patterns.
   * The UI must say so — never present an archetype pattern as a company-specific claim.
   */
  archetypeConfidence: "recognised" | "inferred";
  groundingNote: string;
  roleTitle: string;
  roundType: RoundType;
  roundLabel: string;
  language: string;
  status: "created" | "in_progress" | "completed" | "abandoned" | "failed";
  /** Whether video was consented to. The only thing that may open the camera. */
  consentVideo: boolean;
  startedAt: string | null;
  endedAt: string | null;
  /** How long the round is scheduled to run. */
  durationMinutes: number;
  /**
   * When the round is scheduled to end, decided by the server. The room counts down to
   * this rather than to a clock of its own.
   */
  scheduledEndAt: string | null;
  turnsCompleted: number;
  /** A ceiling on exchanges, not a target — the clock is what ends the round. */
  maxTurns: number;
  currentTurn: TurnView | null;
}

export interface StartSessionRequest {
  companyName: string;
  roleTitle: string;
  roundType: RoundType;
  language: string;
  consentAudio: boolean;
  consentVideo: boolean;
  /**
   * How long the round should run. Omitted, the server picks a realistic 40 minutes —
   * the default lives there so every client gets the same round, not just this one.
   */
  durationMinutes?: number;
}

export interface SubmitAnswerResponse {
  sessionComplete: boolean;
  turnsCompleted: number;
  nextTurn: TurnView | null;
}

export interface SessionSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  roundType: RoundType;
  status: SessionView["status"];
  startedAt: string | null;
  endedAt: string | null;
  hasReport: boolean;
}

// ---------------------------------------------------------------------------
// Report (PRD 09)
// ---------------------------------------------------------------------------

/** A score is only shown when it is anchored to something the candidate said. */
export interface ReportCompetency {
  competency: string;
  score: number;
  maxScore: number;
  rationale: string;
  evidenceQuote: string;
  turnIndex: number | null;
}

export interface ReportAnnotation {
  turnIndex: number;
  question: string;
  worked: string | null;
  vague: string | null;
  wouldProbe: string | null;
  strongerFraming: string | null;
}

export interface ReportCommunication {
  structure: string;
  fillerDensity: string;
  pace: string;
  rambling: string;
  handlingUncertainty: string;
}

export interface ReportPracticeItem {
  focus: string;
  why: string;
  drill: string;
}

/** Always rendered as a simulation, never as a verdict. */
export interface ReportOutcome {
  label: string;
  likelihood: string;
  reasoning: string;
}

/**
 * How much the interviewer had to help, and what the candidate did with it.
 *
 * The counts are computed from the recorded turns; the narrative is written by the model
 * against those counts. Both are shown so the two cannot quietly disagree.
 */
export interface ReportAssistance {
  totalAnswers: number;
  unaidedAnswers: number;
  assistedAnswers: number;
  headline: string;
  narrative: string | null;
  breakdown: Array<{ label: string; count: number }>;
  /** What was actually supplied, in the interviewer's words. */
  moments: string[];
}

export interface SessionReport {
  sessionId: string;
  companyName: string;
  roleTitle: string;
  roundType: RoundType;
  roundLabel: string;
  archetypeLabel: string;
  answeredTurns: number;
  generatedAt: string;
  headline: string;
  summary: string;
  assistance: ReportAssistance;
  competencies: ReportCompetency[];
  annotations: ReportAnnotation[];
  communication: ReportCommunication;
  practicePlan: ReportPracticeItem[];
  recommendedNextSession: string;
  outcomeSimulation: ReportOutcome;
}

/** Derived by grouping completed sessions — there is no stored target list. */
export interface ReadinessGroup {
  companyName: string;
  roleTitle: string;
  sessionsCompleted: number;
  firstAttemptAt: string | null;
  latestAttemptAt: string | null;
  latestAverageScore: number | null;
  firstAverageScore: number | null;
  recurringWeaknesses: string[];
}
