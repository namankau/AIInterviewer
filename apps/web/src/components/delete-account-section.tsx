"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CONTROL_CLASS } from "@/components/ui/field";
import { ApiRequestError, deleteAccount } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAccessToken } from "@/lib/use-access-token";

/** The word typed to confirm. A checkbox is too easy to tick on the way past. */
const CONFIRM_WORD = "delete";

/**
 * Deleting the account, for good.
 *
 * Says exactly what goes before asking, because the list is the promise: every round,
 * report, transcript and recording, the resume and photo, course and Arena progress, and
 * the sign-in. The server does the deleting (`DELETE /api/v1/me`); this page only signs the
 * browser out once the server says it is done, and never claims success it was not told.
 */
export function DeleteAccountSection() {
  const router = useRouter();
  const accessToken = useAccessToken();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  async function remove() {
    if (!accessToken || !confirmed || pending) return;
    setPending(true);
    setError(null);
    try {
      await deleteAccount(accessToken);
    } catch (cause) {
      setPending(false);
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "Your account could not be deleted just now. Nothing has been removed. Try again in a moment.",
      );
      return;
    }
    // The account is gone server-side; the local session is all that is left of it.
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section
      id="delete-account"
      aria-labelledby="delete-account-heading"
      className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-danger/30 bg-danger/5 p-6"
    >
      <h3 id="delete-account-heading" className="text-heading text-ink">
        Delete your account
      </h3>
      <p className="max-w-prose text-caption text-ink-muted">
        This removes everything we hold for you, and it cannot be undone:
      </p>
      <ul className="flex max-w-prose list-disc flex-col gap-1 pl-5 text-caption text-ink-muted">
        <li>every round, with its report, transcript and voice recordings</li>
        <li>your resume, your profile photo and your profile details</li>
        <li>your course and Arena progress</li>
        <li>your sign-in — signing in with Google again starts a new, empty account</li>
      </ul>
      <label htmlFor={inputId} className="flex max-w-sm flex-col gap-1.5">
        <span className="text-caption text-ink">
          Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
        </span>
        <input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          className={CONTROL_CLASS}
        />
      </label>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={remove}
          disabled={!confirmed || pending || !accessToken}
          aria-busy={pending}
          className="border-danger/40 text-danger hover:border-danger hover:bg-danger/10"
        >
          {pending ? "Deleting your account…" : "Delete my account"}
        </Button>
      </div>
    </section>
  );
}
