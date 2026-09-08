import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProfilePanel } from "@/components/profile-panel";

export const metadata: Metadata = { title: "Your profile" };

/**
 * Profile and resume (PRD 05).
 *
 * The resume leads the page because it is the thing that changes the interview: without
 * one, a project deep-dive has a job title to work from and has to invent the rest.
 */
export default function ProfilePage() {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Profile</p>
          <h1 className="text-title text-ink">What the interviewer knows about you.</h1>
          <p className="max-w-prose text-body text-ink-muted">
            All of it is optional and none of it is shared. It exists so a round can be about your
            work rather than about a job title.
          </p>
        </header>

        <ProfilePanel />
      </div>
    </AppShell>
  );
}
