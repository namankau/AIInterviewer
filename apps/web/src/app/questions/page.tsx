import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { QuestionBankIndex } from "@/components/question-bank-index";

export const metadata: Metadata = {
  title: "Questions employers have asked",
  // Signed-in only, and not for search engines: whether extracted third-party text goes
  // on public pages is a decision for the owner, not a default (PRD 16).
  robots: { index: false, follow: false },
};

/**
 * The question bank's index (PRD 04, 08).
 *
 * Every entry is a question a document we fetched says an employer asked, and every
 * company here has at least one. Where they come from is stated before the list, because
 * a candidate should know what a tag means before trusting one.
 */
export default function QuestionsPage() {
  return (
    <AppShell breadcrumb="questions">
      <div className="flex max-w-4xl flex-col gap-12">
        <header className="flex flex-col gap-4">
          <h1 className="text-display text-balance text-ink">Questions employers have asked.</h1>
          <p className="max-w-xl text-body text-ink-muted">
            Each one is here because a document says it was asked — the employer’s own careers
            pages, openly licensed collections, or someone’s own published account of their loop —
            and each links to where it was read. A question reported at Amazon and at Microsoft
            carries both.
          </p>
          <p className="max-w-xl text-caption text-ink-subtle">
            Nothing here was written by a model, and nothing was scraped from forums. Looking for how
            a round runs rather than what it asks?{" "}
            <Link href="/rounds" className="underline underline-offset-4 hover:text-ink">
              The rounds
            </Link>
            .
          </p>
        </header>

        <QuestionBankIndex />
      </div>
    </AppShell>
  );
}
