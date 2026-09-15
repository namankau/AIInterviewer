"use client";

import type { BankCompany, BankQuestion, RoundType } from "@acemyinterview/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiRequestError, fetchBankQuestions } from "@/lib/api";
import { describeOrigin, monthYear, questions as questionCount, roundLabel, sources } from "@/lib/question-bank";
import { useAccessToken } from "@/lib/use-access-token";

const PAGE_SIZE = 20;

type Load =
  | { state: "loading" }
  | { state: "not_found" }
  | { state: "failed" }
  | { state: "ready"; company: BankCompany; questions: BankQuestion[]; total: number };

/** Fetches one company's questions, one round type or all, a page at a time. */
export function CompanyQuestions({ slug }: { slug: string }) {
  const accessToken = useAccessToken();
  const [roundType, setRoundType] = useState<RoundType | null>(null);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchBankQuestions(slug, { roundType, limit: PAGE_SIZE, offset: 0 }, { accessToken })
      .then((page) => {
        if (active) setLoad({ state: "ready", company: page.company, questions: page.questions, total: page.total });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoad({ state: error instanceof ApiRequestError && error.status === 404 ? "not_found" : "failed" });
      });
    return () => {
      active = false;
    };
  }, [accessToken, slug, roundType]);

  const loadMore = useCallback(async () => {
    if (!accessToken || load.state !== "ready") return;
    setLoadingMore(true);
    try {
      const page = await fetchBankQuestions(
        slug,
        { roundType, limit: PAGE_SIZE, offset: load.questions.length },
        { accessToken },
      );
      setLoad({ ...load, questions: [...load.questions, ...page.questions], total: page.total });
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, load, roundType, slug]);

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
  if (load.state === "not_found") {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-title text-ink">We hold no company at this address.</h1>
        <p className="text-body text-ink-muted">
          <Link href="/questions" className="text-accent underline underline-offset-4">
            Back to every company with sourced questions
          </Link>
        </p>
      </div>
    );
  }
  if (load.state === "failed") {
    return <p className="text-body text-danger">These questions did not load. Try again in a moment.</p>;
  }
  if (load.state === "loading") {
    return <p className="text-caption text-ink-subtle">Loading…</p>;
  }

  return (
    <CompanyQuestionsView
      company={load.company}
      questions={load.questions}
      total={load.total}
      roundType={roundType}
      onRoundType={(next) => {
        setRoundType(next);
        setLoad({ state: "loading" });
      }}
      onLoadMore={loadMore}
      loadingMore={loadingMore}
    />
  );
}

/**
 * One company's sourced questions, as markup over the data it is handed.
 *
 * Each question carries everything that backs it, because a candidate deciding how much
 * weight to put on "Amazon asks this" needs to see whether that is Amazon's own page or
 * one person's blog post, and how many sources agree.
 */
export function CompanyQuestionsView({
  company,
  questions,
  total,
  roundType,
  onRoundType,
  onLoadMore,
  loadingMore = false,
}: {
  company: BankCompany;
  questions: BankQuestion[];
  total: number;
  roundType: RoundType | null;
  onRoundType?: (roundType: RoundType | null) => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const nothingSourced = company.questionCount === 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Question bank</p>
        <h1 className="text-display text-balance text-ink">{company.name}</h1>
        <p className="max-w-xl text-body text-ink-muted">
          {nothingSourced
            ? `${company.archetypeLabel}.`
            : `${questionCount(company.questionCount)} reported by sources you can open and check. ${company.archetypeLabel}.`}
        </p>
      </header>

      {nothingSourced ? (
        <section aria-labelledby="nothing-sourced" className="flex max-w-xl flex-col gap-3 border-t border-line pt-8">
          <h2 id="nothing-sourced" className="text-heading text-ink">
            Nothing sourced for {company.name} yet.
          </h2>
          <p className="text-body text-ink-muted">
            We have not found a published account of a question {company.name} asked that we can
            cite, so there is nothing to show here — and we will not fill the space with
            questions we wrote ourselves. A round for {company.name} still runs, on general
            patterns for {company.archetypeInProse}, and the room says so.
          </p>
          <p className="pt-1">
            <Link
              href="/interview/new"
              className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
            >
              Set up a round
            </Link>
          </p>
        </section>
      ) : (
        <>
          <div role="group" aria-label="Filter by round" className="flex flex-wrap gap-2">
            <FilterButton pressed={roundType === null} onClick={() => onRoundType?.(null)}>
              All rounds <span className="font-mono text-ink-subtle">{company.questionCount}</span>
            </FilterButton>
            {company.roundTypes
              .filter((count) => count.roundType !== null)
              .map((count) => (
                <FilterButton
                  key={count.roundType}
                  pressed={roundType === count.roundType}
                  onClick={() => onRoundType?.(count.roundType)}
                >
                  {roundLabel(count.roundType)} <span className="font-mono text-ink-subtle">{count.count}</span>
                </FilterButton>
              ))}
          </div>

          {questions.length === 0 ? (
            <p className="text-body text-ink-muted">
              None of {company.name}’s sourced questions are from a {roundLabel(roundType).toLowerCase()} round.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-line border-y border-line">
              {questions.map((question) => (
                <QuestionEntry key={question.id} question={question} current={company.slug} />
              ))}
            </ol>
          )}

          {questions.length < total ? (
            <div>
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-line-strong px-4 py-2 text-caption text-ink hover:border-ink disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : `Show more (${total - questions.length} left)`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-caption transition-colors ${
        pressed ? "border-accent bg-accent-wash text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionEntry({ question, current }: { question: BankQuestion; current: string }) {
  const reported = monthYear(question.lastReported);

  return (
    <li className="flex flex-col gap-3 py-7">
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{roundLabel(question.roundType)}</p>
      <p className="max-w-2xl font-display text-title text-balance text-ink">{question.text}</p>
      <p className="text-caption text-ink-muted">
        Reported in {sources(question.corroboration)}
        {" · "}
        {reported ? `last reported ${reported}` : "no source dates it"}
      </p>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-caption">
        <span className="text-ink-subtle">Reported at</span>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {question.companies.map((tag) => (
            <li key={tag.slug}>
              <Link
                href={`/questions/${tag.slug}`}
                aria-current={tag.slug === current ? "page" : undefined}
                className={
                  tag.slug === current
                    ? "font-medium text-ink"
                    : "text-accent underline-offset-4 hover:underline"
                }
              >
                {tag.name}
              </Link>
              {tag.corroboration > 1 ? <span className="font-mono text-ink-subtle"> ×{tag.corroboration}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <ul aria-label="Sources" className="flex flex-col gap-1 border-l-2 border-line-strong pl-3 text-caption text-ink-muted">
        {question.citations.map((citation, index) => (
          <li key={`${citation.url ?? citation.title}-${index}`}>
            <span className="text-ink">{describeOrigin(citation)}</span>
            {" — "}
            {citation.url ? (
              <a href={citation.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">
                {citation.title}
              </a>
            ) : (
              citation.title
            )}
            {citation.year ? <span className="font-mono text-ink-subtle"> {citation.year}</span> : null}
          </li>
        ))}
      </ul>
    </li>
  );
}
