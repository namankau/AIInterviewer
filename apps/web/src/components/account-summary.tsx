"use client";

import type { MeResponse } from "@acemyinterview/shared";
import { useEffect, useState } from "react";

import Link from "next/link";

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
 * Who is signed in, at the foot of the rail, as the way in to their profile.
 *
 * Signing out is not here. It is a thing you do rarely and cannot undo without typing a
 * password again, and a control like that sitting permanently in the furniture is both
 * clutter and a hazard. It lives on the profile page, which is where the rest of "this is
 * my account" already lives, and this block is the link to it.
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

  return (
    <div className="border-t border-line pt-4">
      {state.status === "loading" ? (
        <p role="status" className="text-caption text-ink-subtle">
          Loading your profile…
        </p>
      ) : state.status === "error" ? (
        <p role="alert" className="text-caption text-danger">
          {state.message}
        </p>
      ) : (
        <Link
          href="/profile"
          className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-raised"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-wash font-mono text-micro text-accent"
          >
            {initialsOf(state.me.displayName ?? state.me.email)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-caption text-ink">
              {state.me.displayName ?? state.me.email}
            </span>
            <span className="truncate text-micro text-ink-subtle">
              {LANGUAGE_LABELS[state.me.preferredLanguage] ?? state.me.preferredLanguage}
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}

/** Two letters, so the rail has a fixed anchor point whatever the name's length. */
function initialsOf(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase();
}
