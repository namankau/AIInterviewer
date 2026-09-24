import type { Route } from "next";
import Link from "next/link";

import { AccountSummary } from "@/components/account-summary";
import { RailNav } from "@/components/rail-nav";
import { ActionLink } from "@/components/ui/action-link";

/**
 * The frame every signed-in page sits in.
 *
 * A rail rather than a top bar, because the pages behind it are lists and documents —
 * a report, a history, a catalogue — and a persistent left edge is what makes a set of
 * pages read as one tool instead of as a series of screens. It is also where a candidate
 * looks for the thing they came to do, which is why "New interview" sits at the top of
 * it and nothing competes with it.
 *
 * The deep-navy rail gives the workspace a stable visual anchor while the page remains a
 * bright working surface. The same blue carries the primary action and current-page marker,
 * so colour has a predictable meaning instead of acting as decoration.
 *
 * Deliberately not applied to the interview room. That page is near-empty by design and
 * a navigation rail beside a live interview would be an invitation to leave it.
 */
export function AppShell({
  breadcrumb,
  parent,
  wide = false,
  children,
}: {
  breadcrumb?: string;
  /** A page this one sits under (a report under rounds); adds a middle crumb and a back link. */
  parent?: { label: string; href: Route };
  /** Gives document-like tools (such as the chapter reader) room for their own local navigation. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <nav
        aria-label="Main"
        className="flex shrink-0 flex-col gap-7 border-b border-white/10 bg-navy px-5 py-5 text-on-navy md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0 md:px-6 md:py-7"
      >
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 rounded-lg text-heading font-bold tracking-tight text-on-navy"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-caption font-extrabold text-accent-contrast shadow-[0_8px_24px_rgba(26,100,240,0.32)] transition-transform group-hover:-rotate-3">
            AI
          </span>
          <span>AceMyInterview</span>
        </Link>

        <ActionLink
          href="/interview/new"
          className="w-full shadow-[0_10px_28px_rgba(26,100,240,0.28)]"
        >
          <span aria-hidden="true" className="text-heading leading-none">
            +
          </span>
          New interview
        </ActionLink>

        <RailNav />

        <div className="md:mt-auto">
          <AccountSummary />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,var(--surface-tint)_0,transparent_22rem)]">
        {breadcrumb ? (
          <div className="border-b border-line bg-surface-raised/85 px-6 py-3 backdrop-blur md:px-12">
            <p className="font-mono text-micro tracking-widest text-ink-subtle lowercase">
              <Link href="/dashboard" className="hover:text-ink">
                home
              </Link>
              <span className="px-1.5">/</span>
              {parent ? (
                <>
                  <Link href={parent.href} className="hover:text-ink">
                    {parent.label}
                  </Link>
                  <span className="px-1.5">/</span>
                </>
              ) : null}
              <span aria-current="page" className="text-ink-muted">
                {breadcrumb}
              </span>
            </p>
            {parent ? (
              <Link
                href={parent.href}
                className="mt-1.5 inline-block text-caption font-medium text-accent-strong hover:underline"
              >
                <span aria-hidden="true">←</span> Back to {parent.label}
              </Link>
            ) : null}
          </div>
        ) : null}
        {/*
          * Wide enough to compose in, capped so a line of prose never runs the width of a
          * monitor. The page used to be a 768px column pinned to the left of whatever
          * screen it was on, with the entire right-hand side empty — not restraint, just
          * an unused canvas.
          */}
        <main
          className={`mx-auto w-full flex-1 px-6 py-10 md:px-12 md:py-14 ${
            wide ? "max-w-[100rem]" : "max-w-6xl"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
