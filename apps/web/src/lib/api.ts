import type {
  ApiError,
  BankCompany,
  BankQuestionPage,
  RoundType,
  CodeRunResult,
  EntitlementView,
  HintView,
  MeResponse,
  ProfileDetails,
  ResumeView,
  SkillView,
  UpdateProfileRequest,
  ReadinessGroup,
  RoundDraft,
  RunCodeRequest,
  SessionReport,
  SessionSummary,
  SessionView,
  StartSessionRequest,
  SubmitAnswerResponse,
  TurnView,
  UsageCounts,
} from "@acemyinterview/shared";

import { env } from "@/lib/env";

/** A non-2xx response from the API, carrying the error envelope it returned. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

interface ApiGetOptions {
  accessToken: string;
  signal?: AbortSignal;
}

async function apiGet<T>(path: string, { accessToken, signal }: ApiGetOptions): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    // The API is the authority on freshness; never serve a cached profile.
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      envelope?.error ?? "unknown_error",
      envelope?.message ?? `Request to ${path} failed with status ${response.status}.`,
    );
  }

  return (await response.json()) as T;
}

async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Let the browser set the multipart boundary itself.
      ...(isForm || body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
  });

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      envelope?.error ?? "unknown_error",
      envelope?.message ?? `Request to ${path} failed with status ${response.status}.`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** `GET /api/v1/me` — the same endpoint the mobile apps will call. */
export function fetchMe(options: ApiGetOptions): Promise<MeResponse> {
  return apiGet<MeResponse>("/api/v1/me", options);
}

/**
 * The public usage counters. No token: this is two aggregate integers, read by the
 * landing page before anyone has signed in.
 *
 * Returns null rather than throwing. A counter is decoration; a landing page that fails
 * to render because a statistic did not load would be a poor trade.
 */
export async function fetchUsage(signal?: AbortSignal): Promise<UsageCounts | null> {
  try {
    const response = await fetch(`${env.apiBaseUrl}/api/v1/usage`, {
      headers: { Accept: "application/json" },
      signal,
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as UsageCounts;
  } catch {
    return null;
  }
}

// -- profile and resume ------------------------------------------------------

export function fetchProfile(options: ApiGetOptions): Promise<ProfileDetails> {
  return apiGet<ProfileDetails>("/api/v1/me/profile", options);
}

export function updateProfile(
  accessToken: string,
  body: UpdateProfileRequest,
): Promise<ProfileDetails> {
  return apiSend<ProfileDetails>("/api/v1/me/profile", "PUT", accessToken, body);
}

export function upsertSkill(
  accessToken: string,
  body: { name: string; selfRatedConfidence?: number; flaggedAsWeak?: boolean },
): Promise<SkillView[]> {
  return apiSend<SkillView[]>("/api/v1/me/skills", "PUT", accessToken, body);
}

export async function deleteSkill(accessToken: string, name: string): Promise<void> {
  await apiSend<void>(`/api/v1/me/skills/${encodeURIComponent(name)}`, "DELETE", accessToken);
}

/**
 * Uploads and parses a resume.
 *
 * Slow on purpose: the parse happens inside this request rather than behind a status
 * poll, because the candidate is waiting to find out whether we read their resume
 * correctly and an answer they have to come back for is worse than a wait they can see.
 */
export function uploadResume(accessToken: string, file: File): Promise<ResumeView> {
  const form = new FormData();
  form.set("file", file);
  return apiSend<ResumeView>("/api/v1/me/resume", "POST", accessToken, form);
}

export function uploadAvatar(accessToken: string, file: File): Promise<ProfileDetails> {
  const form = new FormData();
  form.set("file", file);
  return apiSend<ProfileDetails>("/api/v1/me/avatar", "POST", accessToken, form);
}

export async function deleteResume(accessToken: string, id: string): Promise<void> {
  await apiSend<void>(`/api/v1/me/resume/${id}`, "DELETE", accessToken);
}

export function fetchEntitlement(options: ApiGetOptions): Promise<EntitlementView> {
  return apiGet<EntitlementView>("/api/v1/entitlement", options);
}

export function fetchSessions(options: ApiGetOptions): Promise<SessionSummary[]> {
  return apiGet<SessionSummary[]>("/api/v1/sessions", options);
}

export function fetchSession(id: string, options: ApiGetOptions): Promise<SessionView> {
  return apiGet<SessionView>(`/api/v1/sessions/${id}`, options);
}

/**
 * The candidate has entered the room: the round's clock starts now, once. Returns the
 * session with the deadline to count down to; calling it again changes nothing, so a
 * reload never restarts the clock.
 */
export function beginSession(accessToken: string, id: string): Promise<SessionView> {
  return apiSend<SessionView>(`/api/v1/sessions/${id}/begin`, "POST", accessToken);
}

/**
 * One question. The room asks for this while a turn's speech is still `pending`, to
 * pick up the interviewer's voice after the question text has already been shown.
 */
export function fetchTurn(
  sessionId: string,
  turnIndex: number,
  options: ApiGetOptions,
): Promise<TurnView> {
  return apiGet<TurnView>(`/api/v1/sessions/${sessionId}/turns/${turnIndex}`, options);
}

export function fetchReport(id: string, options: ApiGetOptions): Promise<SessionReport> {
  return apiGet<SessionReport>(`/api/v1/sessions/${id}/report`, options);
}

export function fetchReadiness(options: ApiGetOptions): Promise<ReadinessGroup[]> {
  return apiGet<ReadinessGroup[]>("/api/v1/readiness", options);
}

// -- question bank ----------------------------------------------------------

/** Every company with at least one sourced question. */
export function fetchBankCompanies(options: ApiGetOptions): Promise<BankCompany[]> {
  return apiGet<BankCompany[]>("/api/v1/question-bank/companies", options);
}

/** One page of a company's sourced questions, optionally one round type. 404 for an unknown slug. */
export function fetchBankQuestions(
  company: string,
  query: { roundType?: RoundType | null; limit?: number; offset?: number },
  options: ApiGetOptions,
): Promise<BankQuestionPage> {
  const params = new URLSearchParams({ company });
  if (query.roundType) params.set("roundType", query.roundType);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  return apiGet<BankQuestionPage>(`/api/v1/question-bank?${params.toString()}`, options);
}

/**
 * Reads one line of intent into a draft round. Creates nothing — the candidate corrects
 * the draft and starts the session through `startSession` like anyone else.
 */
export function composeRound(accessToken: string, query: string): Promise<RoundDraft> {
  return apiSend<RoundDraft>("/api/v1/round-drafts", "POST", accessToken, { query });
}

export function startSession(accessToken: string, request: StartSessionRequest): Promise<SessionView> {
  return apiSend<SessionView>("/api/v1/sessions", "POST", accessToken, request);
}

/**
 * Asks the interviewer for a nudge on the current question. One per question, and it
 * goes on the record — the API is the authority on both.
 */
export function requestHint(
  accessToken: string,
  sessionId: string,
  turnIndex: number,
): Promise<HintView> {
  return apiSend<HintView>(
    `/api/v1/sessions/${sessionId}/turns/${turnIndex}/hint`,
    "POST",
    accessToken,
  );
}

/**
 * Stores what the candidate has on the board — the code they wrote, or the design they
 * drew — so a reload does not lose it (PRD 06).
 *
 * Called repeatedly while they work, so it is deliberately quiet: a failed save is not
 * worth interrupting somebody mid-thought over, and the next one will carry the same
 * state anyway.
 */
export function saveBoard(accessToken: string, id: string, board: unknown): Promise<void> {
  return apiSend<void>(`/api/v1/sessions/${id}/board`, "PUT", accessToken, board);
}

/** Runs the candidate's code for a round they own. Java only; Python runs in the browser. */
export function runCode(
  accessToken: string,
  id: string,
  request: RunCodeRequest,
): Promise<CodeRunResult> {
  return apiSend<CodeRunResult>(`/api/v1/sessions/${id}/run`, "POST", accessToken, request);
}

/**
 * Ends the round now and completes it, so the report is written from what has been
 * answered so far. The opposite of [abandonSession], which forfeits it.
 */
export function finishSession(accessToken: string, id: string): Promise<SubmitAnswerResponse> {
  return apiSend<SubmitAnswerResponse>(`/api/v1/sessions/${id}/finish`, "POST", accessToken);
}

export function abandonSession(accessToken: string, id: string): Promise<void> {
  return apiSend<void>(`/api/v1/sessions/${id}/abandon`, "POST", accessToken);
}

/**
 * Deletes one past round: the transcript, the report and the recordings.
 *
 * Irreversible, and there is nothing behind it to restore from — confirm before calling
 * it. The server takes the owner from the token, so a round that is not the caller's
 * comes back as a 404 rather than a refusal.
 */
export async function deleteSession(accessToken: string, id: string): Promise<void> {
  await apiSend<void>(`/api/v1/sessions/${id}`, "DELETE", accessToken);
}

/** Uploads one spoken answer, plus video when the candidate consented to it. */
export function submitAnswer(
  accessToken: string,
  sessionId: string,
  turnIndex: number,
  audio: Blob,
  video: Blob | null,
  speaksLocally = false,
  /** Submit pressed mid-answer: assess this answer as the last one and end the round. */
  endRound = false,
): Promise<SubmitAnswerResponse> {
  const form = new FormData();
  form.append("turnIndex", String(turnIndex));
  form.append("endRound", String(endRound));
  // Told per turn rather than per session: it describes this browser, and the same
  // candidate may come back on a phone with no usable voice.
  form.append("speaksLocally", String(speaksLocally));
  form.append("audio", audio, "answer.webm");
  if (video) {
    form.append("video", video, "answer-video.webm");
  }
  return apiSend<SubmitAnswerResponse>(`/api/v1/sessions/${sessionId}/turns`, "POST", accessToken, form);
}
