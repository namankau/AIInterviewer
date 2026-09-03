import type {
  ApiError,
  EntitlementView,
  HintView,
  MeResponse,
  ReadinessGroup,
  RoundDraft,
  SessionReport,
  SessionSummary,
  SessionView,
  StartSessionRequest,
  SubmitAnswerResponse,
  TurnView,
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
  method: "POST" | "PATCH",
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

export function abandonSession(accessToken: string, id: string): Promise<void> {
  return apiSend<void>(`/api/v1/sessions/${id}/abandon`, "POST", accessToken);
}

/** Uploads one spoken answer, plus video when the candidate consented to it. */
export function submitAnswer(
  accessToken: string,
  sessionId: string,
  turnIndex: number,
  audio: Blob,
  video: Blob | null,
): Promise<SubmitAnswerResponse> {
  const form = new FormData();
  form.append("turnIndex", String(turnIndex));
  form.append("audio", audio, "answer.webm");
  if (video) {
    form.append("video", video, "answer-video.webm");
  }
  return apiSend<SubmitAnswerResponse>(`/api/v1/sessions/${sessionId}/turns`, "POST", accessToken, form);
}
