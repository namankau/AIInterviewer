"use client";

import type { BankCompany } from "@acemyinterview/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchBankCompanies } from "@/lib/api";
import { questions, roundLabel } from "@/lib/question-bank";
import { useAccessToken } from "@/lib/use-access-token";

type Load = { state: "loading" } | { state: "failed" } | { state: "ready"; companies: BankCompany[] };

/** Fetches the companies with sourced questions and hands them to [QuestionBankIndexView]. */
export function QuestionBankIndex() {
  const accessToken = useAccessToken();
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchBankCompanies({ accessToken })
      .then((companies) => active && setLoad({ state: "ready", companies }))
      .catch(() => active && setLoad({ state: "failed" }));
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (accessToken === null) {
    return (
      <p className="text-body text-ink-muted">
        <Link href="/login?next=/questions" className="text-accent underline underline-offset-4">
          Sign in
        </Link>{" "}
        to see the question bank.
      </p>
    );
  }
  if (load.state === "failed") {
    return <p className="text-body text-danger">The question bank did not load. Try again in a moment.</p>;
  }
  if (load.state === "loading") {
    return <p className="text-caption text-ink-subtle">Loading the question bank…</p>;
  }
  return <QuestionBankIndexView companies={load.companies} />;
}

/**
 * The companies, set as the index at the back of a book rather than a wall of cards:
 * grouped under their initial, a name you can scan down, and the count beside it. What a
 * candidate came to find is their employer, and an index is the fastest shape for that.
 */
export function QuestionBankIndexView({ companies }: { companies: BankCompany[] }) {
  if (companies.length === 0) {
    return (
      <section aria-labelledby="bank-empty" className="flex max-w-xl flex-col gap-3 border-t border-line pt-8">
        <h2 id="bank-empty" className="text-heading text-ink">
          Nothing sourced yet.
        </h2>
        <p className="text-body text-ink-muted">
          No company has a question here yet, because nothing goes in until a document we can
          cite says it was asked. Until then, every round runs on general patterns for the kind
          of employer you name, and the room tells you so.
        </p>
      </section>
    );
  }

  const groups = new Map<string, BankCompany[]>();
  for (const company of companies) {
    const first = company.name.charAt(0);
    const initial = /[a-z]/i.test(first) ? first.toUpperCase() : "#";
    groups.set(initial, [...(groups.get(initial) ?? []), company]);
  }

  return (
    <div className="flex flex-col gap-10">
      {[...groups.entries()].map(([initial, members]) => (
        <section key={initial} aria-labelledby={`initial-${initial}`} className="grid gap-3 md:grid-cols-[3rem_minmax(0,1fr)]">
          <h2 id={`initial-${initial}`} className="font-display text-title text-ink-subtle">
            {initial}
          </h2>
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {members.map((company) => (
              <li key={company.slug} className="flex flex-col gap-1.5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <Link
                  href={`/questions/${company.slug}`}
                  className="text-heading text-ink underline-offset-4 hover:underline"
                >
                  {company.name}
                </Link>
                <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-caption text-ink-subtle sm:justify-end">
                  <span className="text-ink-muted">{questions(company.questionCount)}</span>
                  {company.roundTypes.map((count) => (
                    <span key={count.roundType ?? "unstated"}>
                      {roundLabel(count.roundType)} {count.count}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
