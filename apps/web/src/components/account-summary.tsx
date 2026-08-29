"use client";

import type { MeResponse } from "@acemyinterview/shared";
import { useEffect, useState } from "react";

import { fetchMe } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type State =
  | { status: "loading" }
  | { status: "ready"; me: MeResponse }
  | { status: "error"; message: string };

const LANGUAGE_LABELS: Record<string, string> = {
  english: "English",
  hindi_english: "Hindi-English",
  regional: "Regional",
};

/**
 * Reads the signed-in candidate from `GET /api/v1/me`.
 *
 * Deliberately a client-side call to the versioned public API rather than a
 * server-rendered database read: the mobile apps will make exactly this request, and
 * profile flows must not acquire a server-rendering dependency (PRD 13).
 */
export function AccountSummary() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const {
          data: { session },
        } = await createSupabaseBrowserClient().auth.getSession();

        if (!session) {
          throw new Error("This browser has no active session.");
        }

        const me = await fetchMe({ accessToken: session.access_token, signal: controller.signal });
        if (!controller.signal.aborted) {
          setState({ status: "ready", me });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Your profile could not be loaded.",
        });
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return (
      <p role="status" className="text-caption text-ink-muted">
        Loading your profile…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="text-caption text-danger">
        {state.message}
      </p>
    );
  }

  const { me } = state;

  return (
    <dl className="flex flex-col gap-4 sm:flex-row sm:gap-10">
      <div>
        <dt className="text-caption text-ink-subtle">Signed in as</dt>
        <dd className="text-body text-ink">{me.displayName ?? me.email}</dd>
      </div>
      <div>
        <dt className="text-caption text-ink-subtle">Interview language</dt>
        <dd className="text-body text-ink">{LANGUAGE_LABELS[me.preferredLanguage] ?? me.preferredLanguage}</dd>
      </div>
    </dl>
  );
}
