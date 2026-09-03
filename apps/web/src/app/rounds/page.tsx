import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ROUND_CATALOGUE } from "@/lib/rounds";

export const metadata: Metadata = {
  title: "The rounds we run",
  description:
    "Every round this runs, and who each one is for: Infosys techno-managerial panels, " +
    "Big Four case rounds, European competency interviews, global product system design, " +
    "and the HR conversation about notice, relocation and visa that nobody rehearses.",
};

/**
 * The catalogue.
 *
 * Server-rendered on purpose: organic search on "<employer> interview" and
 * "<round type> interview" is a primary acquisition channel (PRD 11), and this page is
 * the one that names them.
 *
 * Set as an editorial list rather than a grid of identical cards. Each entry earns its
 * place by being specific — a real employer, a real round name, and what an interviewer
 * is actually listening for — because a candidate deciding whether to trust this with
 * their preparation reads the specifics and skips the adjectives.
 */
export default function RoundsPage() {
  return (
    <AppShell breadcrumb="rounds">
      <div className="flex max-w-3xl flex-col gap-12">
        <header className="flex flex-col gap-4">
          <h1 className="text-display text-balance text-ink">The rounds.</h1>
          <p className="max-w-xl text-body text-ink-muted">
            Eight rounds, each with its own structure and its own rubric. An Infosys
            techno-managerial panel is not a Google system design round, and preparing for one
            does not prepare you for the other.
          </p>
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            All rounds · {ROUND_CATALOGUE.length}
          </p>
        </header>

        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {ROUND_CATALOGUE.map((round) => (
            <li key={round.value} className="flex flex-col gap-2.5 py-7">
              <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                {round.eyebrow}
              </p>
              <h2 className="text-heading text-ink">{round.label}</h2>
              <p className="max-w-xl text-body text-ink-muted">{round.blurb}</p>
              <p className="max-w-xl border-l-2 border-line-strong pl-3 text-caption text-ink-muted">
                <span className="text-ink">What the interviewer is listening for:</span>{" "}
                {round.listeningFor}
              </p>
              <p className="pt-0.5 font-mono text-caption text-ink-subtle">{round.whoRunsIt}</p>
            </li>
          ))}
        </ul>

        <section className="flex flex-col items-start gap-4">
          <h2 className="text-heading text-ink">Not sure which one you are sitting?</h2>
          <p className="max-w-xl text-body text-ink-muted">
            Describe the interview in one line — the employer, when it is, what you are worried
            about — and the round gets set up from that. You correct it before anything starts.
          </p>
          <Link
            href="/interview/new"
            className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
          >
            Set up a round
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
