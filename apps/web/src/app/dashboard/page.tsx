import type { Metadata } from "next";

import { AccountSummary } from "@/components/account-summary";
import { DashboardPanel } from "@/components/dashboard-panel";
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
        <DashboardPanel />
      </main>
    </div>
  );
}
