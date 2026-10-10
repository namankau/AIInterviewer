"use client";

import type { MeResponse } from "@acemyinterview/shared";
import { useEffect, useId, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
 * Who is signed in, at the foot of the rail, and the account actions behind it.
 *
 * The actions sit in a menu that opens from the name rather than in the rail itself.
 * Signing out is rare and cannot be undone without signing in again, so a control for it
 * sitting permanently in the furniture would be clutter and something to hit by accident;
 * one click behind the name it is neither. Deleting the account is only linked from here —
 * it happens on the profile page, where everything it removes is listed first.
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
    <div>
      {state.status === "loading" ? (
        <span role="status" className="grid size-9 animate-pulse place-items-center rounded-full bg-surface-sunken">
          <span className="sr-only">Loading your profile…</span>
        </span>
      ) : state.status === "error" ? (
        <Link href="/profile" role="alert" title={state.message} className="grid size-9 place-items-center rounded-full bg-danger-wash text-caption font-bold text-danger">
          <span aria-hidden>!</span>
          <span className="sr-only">{state.message}</span>
        </Link>
      ) : (
        <AccountMenu me={state.me} />
      )}
    </div>
  );
}

const MENU_ITEM =
  "flex w-full items-center rounded-lg px-3 py-2 text-left text-caption text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";

/**
 * A disclosure rather than an ARIA `menu`: it is a short list of links and one button, and
 * a plain list keeps ordinary Tab navigation instead of asking for arrow-key handling.
 * It expands in place, which works the same in the desktop rail and the stacked mobile header.
 */
function AccountMenu({ me }: { me: MeResponse }) {
  const router = useRouter();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = me.displayName ?? me.email;

  // Closes on Escape (handing focus back to the name) and on a press anywhere else.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2.5 rounded-xl px-1 py-2 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[#a8e7d7] text-caption font-bold text-navy ring-1 ring-white"
        >
          {initialsOf(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="hidden max-w-28 truncate text-caption font-semibold text-ink lg:block">{name}</span>
          <span className="hidden truncate text-micro text-ink-subtle lg:block">
            {LANGUAGE_LABELS[me.preferredLanguage] ?? me.preferredLanguage}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`hidden size-4 shrink-0 fill-none stroke-current stroke-2 text-ink-subtle transition-transform lg:block ${open ? "" : "rotate-180"}`}
        >
          <polyline points="4,10 8,6 12,10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul id={menuId} className="absolute top-[calc(100%+0.5rem)] right-0 z-50 flex min-w-56 flex-col gap-0.5 rounded-xl border border-line bg-surface-raised p-1.5 shadow-[var(--shadow-lg)]">
          <li>
            <Link href="/profile" className={MENU_ITEM} onClick={() => setOpen(false)}>
              Profile and resume
            </Link>
          </li>
          <li>
            <Link href="/history" className={MENU_ITEM} onClick={() => setOpen(false)}>
              All your rounds
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-busy={signingOut}
              className={MENU_ITEM}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </li>
          <li className="mt-1 border-t border-line pt-1">
            <Link
              href="/profile#delete-account"
              className={`${MENU_ITEM} text-ink-subtle hover:text-danger`}
              onClick={() => setOpen(false)}
            >
              Delete account…
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** Two letters, so the rail has a fixed anchor point whatever the name's length. */
function initialsOf(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase();
}
