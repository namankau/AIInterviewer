import type { ResumeParseStatus, RoundType } from "./domain.js";

/**
 * How much interviewing this product has done, across everyone.
 *
 * Aggregate only — two integers, nothing that identifies a candidate or an employer —
 * which is what makes it safe to serve unauthenticated.
 */
export interface UsageCounts {
  /** Rounds that reached `completed`. An abandoned session is not an interview. */
  interviewsCompleted: number;
  /** Reports actually composed. Lower than the rounds when someone never opened theirs. */
  reportsGenerated: number;
}

/** Whether the candidate may start another interview, and why not if not. */
export interface EntitlementView {
  allowed: boolean;
  reason: "allowed" | "session_in_progress" | "free_tier_exhausted";
  message: string;
  /**
   * How many free rounds are left, or null when there is no limit.
   *
   * Null is the case today: every round is free until there is a paid tier worth gating
   * against. `free_tier_exhausted` cannot occur while it is null.
   */
  remainingFree: number | null;
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

/** One line of intent, as the candidate typed it. */
export interface ComposeRoundRequest {
  query: string;
}

/**
 * A round drafted from that one line, shown back before anything is created.
 *
 * Nothing is saved. The candidate corrects what is wrong and starts the round through
 * the normal endpoint, so the composer is a faster way into the same setup rather than a
 * second way to create a session.
 *
 * `companyName` may be empty, and that is an answer rather than a failure: the round
 * runs on general patterns and `groundingNote` says so. A guessed employer would be
 * worse, because it silently changes which loop the candidate practises against.
 */
export interface RoundDraft {
  companyName: string;
  roleTitle: string;
  level: string;
  roundType: RoundType;
  roundLabel: string;
  durationMinutes: number;
  language: string;
  /** One sentence back to the candidate, saying what was taken from what they wrote. */
  understood: string;
  /** Everything filled in that they did not say, so they can correct it at a glance. */
  assumptions: string[];
  confidence: "high" | "medium" | "low";
  archetypeLabel: string;
  archetypeConfidence: "recognised" | "inferred";
  groundingNote: string;
}

export interface StartSessionRequest {
  /**
   * This browser will read the questions out itself, so the server should not synthesise
   * them. A browser with a modern neural voice speaks instantly and for nothing, against
   * a model quota of a hundred calls a day.
   */
  speaksLocally?: boolean;
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

/**
 * Help the candidate asked for, and what asking cost them.
 *
 * `assistanceLabel` is shown in the room the moment the hint arrives. Someone deciding
 * whether to ask should learn the price then, not when they read the report.
 */
export interface HintView {
  turnIndex: number;
  text: string;
  assistanceLevel: "redirected" | "hinted" | "guided";
  assistanceLabel: string;
}

export interface SubmitAnswerResponse {
  sessionComplete: boolean;
  turnsCompleted: number;
  nextTurn: TurnView | null;
}

/**
 * One past round, as the candidate's history lists it.
 *
 * The retention fields are here so a client never has to guess what a "Read report" link
 * will do. `reportExpired` means the report, the transcript and the recordings have been
 * cleared and are not coming back — do not render the link, because following it is the
 * broken page these fields exist to prevent. `reportExpiresAt` is when that will happen,
 * so the candidate can be warned before it does rather than after. And
 * `reportRetentionDays` is the rule itself, sent rather than written into the browser:
 * it is one property on the server, and a client that hardcodes the number will still be
 * saying it on the day somebody changes it.
 */
export interface SessionSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  roundType: RoundType;
  status: SessionView["status"];
  startedAt: string | null;
  endedAt: string | null;
  hasReport: boolean;
  /** Cleared by retention. There is nothing left to open, and nothing to recompose from. */
  reportExpired: boolean;
  /** ISO-8601 instant. Null once the round has been cleared. */
  reportExpiresAt: string | null;
  /** How long a report is kept, in days. */
  reportRetentionDays: number;
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

/**
 * One thing the candidate did well or badly, with the words that show it.
 *
 * Competency scores say how well. These say at what, and what to do — which is what a
 * candidate actually leaves with. Both are dropped server-side if the quote is not in
 * the transcript.
 */
export interface ReportAssessedArea {
  area: string;
  evidenceQuote: string;
  turnIndex: number | null;
  whyItMatters: string;
  whatToDo: string;
}

/** Where a real, retrievable document can be cited. Empty until there is a corpus. */
export interface ProvenanceSource {
  title: string;
  publisher: string | null;
  url: string | null;
  year: number | null;
}

/**
 * Why one question was asked, recorded when it was composed rather than reconstructed
 * afterwards.
 */
export interface ReportQuestionSource {
  turnIndex: number;
  question: string;
  phase: TurnPhase;
  /** What it was testing. */
  probes: string;
  /** Why this candidate got it, referring to what they had already said. */
  askedBecause: string;
  /** The archetype-level pattern behind it. */
  basis: string;
  tier: "model_knowledge" | "published_source" | "community_reported";
  /** What the tier means, in words shown to the candidate. */
  tierDisclosure: string;
  sources: ProvenanceSource[];
}

/**
 * The provenance section of the report.
 *
 * `disclosure` is the load-bearing field and it is deliberately unflattering: today
 * every question is `model_knowledge` with no sources, and saying so is the difference
 * between a citation and a claim. Never render the entries without it.
 */
export interface ReportQuestionSources {
  entries: ReportQuestionSource[];
  employerRecognised: boolean;
  archetypeLabel: string;
  headline: string;
  disclosure: string;
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
  strengths: ReportAssessedArea[];
  developmentAreas: ReportAssessedArea[];
  questionSources: ReportQuestionSources;
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

// ---------------------------------------------------------------------------
// Profile and resume (PRD 05)
// ---------------------------------------------------------------------------

export interface ResumeEmployment {
  employer: string;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
}

export interface ResumeProject {
  name: string;
  description: string | null;
  technologies: string[];
}

/**
 * The resume as the candidate's own profile page shows it back to them.
 *
 * `lowConfidenceFields` is the important one: the parser names what it was unsure of
 * rather than guessing, and the page has to surface that. A wrong employer silently
 * degrades every future interview, and the candidate is the only one who can catch it.
 */
export interface ResumeView {
  id: string;
  filename: string;
  status: ResumeParseStatus;
  error: string | null;
  uploadedAt: string | null;
  headline: string | null;
  employments: ResumeEmployment[];
  projects: ResumeProject[];
  detectedSkills: string[];
  lowConfidenceFields: string[];
  /** Derived from the dates by the server, never claimed by the resume. */
  totalExperienceMonths: number | null;
  gapCount: number;
  shortTenureCount: number;
}

export interface SkillView {
  name: string;
  selfRatedConfidence: number | null;
  detectedInResume: boolean;
  flaggedAsWeak: boolean;
}

export interface ProfileDetails {
  resume: ResumeView | null;
  skills: SkillView[];
  avatarUrl: string | null;
  /**
   * What the candidate saved about themselves. These used to be absent, which made the
   * profile write-only: everything typed into the form persisted and none of it ever came
   * back, so it read as a save that had silently failed.
   */
  currentLevel: string | null;
  targetLevel: string | null;
  linkedinUrl: string | null;
}

export interface UpdateProfileRequest {
  function?: string;
  currentLevel?: string;
  targetLevel?: string;
  location?: string;
  headline?: string;
  linkedinUrl?: string;
  noticePeriodDays?: number;
  workAuthorisationStatus?: string;
  relocationIntent?: string;
  peopleManagementScope?: string;
}
