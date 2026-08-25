import type { Metadata } from "next";

import { AccountSummary } from "@/components/account-summary";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Empty authenticated state.
 *
 * The dashboard's job is to start the next interview, so there is exactly one primary
 * action here and nothing competing with it. Company and role are named at the point
 * of starting a session — there is no target list to configure, by design (PRD 05).
 */
export default function DashboardPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-6">
        <p className="text-caption tracking-wide text-ink-subtle uppercase">InterviewOS</p>
        <SignOutButton />
      </header>

      <main className="flex flex-1 flex-col gap-12 py-12">
        <AccountSummary />

        <section aria-labelledby="next-interview" className="flex flex-col gap-5">
          <h1 id="next-interview" className="text-title text-ink">
            Start your first interview
          </h1>
          <p className="max-w-prose text-body text-ink-muted">
            You will name the company and the role when you begin. Nothing to set up in advance,
            and no limit on how many employers you practise for.
          </p>
          <div>
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast opacity-50"
            >
              Start an interview
            </button>
            <p className="pt-3 text-caption text-ink-subtle">
              Interview sessions arrive in a later task.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
