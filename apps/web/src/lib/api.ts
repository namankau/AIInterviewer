import type { ApiError, MeResponse } from "@interviewos/shared";

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

/** `GET /api/v1/me` — the same endpoint the mobile apps will call. */
export function fetchMe(options: ApiGetOptions): Promise<MeResponse> {
  return apiGet<MeResponse>("/api/v1/me", options);
}
