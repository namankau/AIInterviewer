import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProfilePanel } from "@/components/profile-panel";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Your profile" };

/**
 * Profile and resume (PRD 05).
 *
 * The resume leads the page because it is the thing that changes the interview: without
 * one, a project deep-dive has a job title to work from and has to invent the rest.
 */
export default function ProfilePage() {
  return (
    <AppShell breadcrumb="profile">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <header className="relative overflow-hidden rounded-[1.5rem] bg-navy p-7 text-on-navy shadow-[var(--shadow-md)] sm:p-9">
          <div aria-hidden="true" className="absolute -top-24 -right-16 size-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-col gap-3">
          <p className="pill pill-navy w-fit">Your interview context</p>
          <h1 className="text-display text-balance text-on-navy">What the interviewer knows about you.</h1>
          <p className="max-w-2xl text-body text-on-navy-muted">
            All of it is optional and none of it is shared. It exists so a round can be about your
            work rather than about a job title.
          </p>
          </div>
        </header>

        <ProfilePanel />

        {/*
          * Signing out lives here rather than in the rail. It is rare, it cannot be undone
          * without a password, and a control like that sitting permanently beside the
          * navigation is both clutter and something to hit by accident. This is the page
          * that is already about "my account", so this is where leaving it belongs.
          */}
        <section
          aria-labelledby="session"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-sunken p-6"
        >
          <h2 id="session" className="text-heading text-ink">
            This browser
          </h2>
          <p className="max-w-prose text-caption text-ink-subtle">
            Signing out clears your session on this device only. Your resume, rounds and reports
            are untouched and are here when you come back.
          </p>
          <div className="flex pt-1">
            <SignOutButton />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
