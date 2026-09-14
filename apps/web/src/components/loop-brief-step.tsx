"use client";

import type { LoopBrief, PrepPlan, RoundType } from "@acemyinterview/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiRequestError, fetchLoopBrief, fetchPrepPlan } from "@/lib/api";
import { ROUND_CATALOGUE } from "@/lib/rounds";

/**
 * "How <Company> interviews for <Role>" — the layout the owner asked for between the
 * composer and the setup form: what we actually know about the loop, a plan built from
 * it, and then any round the candidate wants, literally one click away.
 *
 * Sourced stages and the general pattern are always shown side by side and labelled —
 * never merged into one undifferentiated list — because the whole point of this screen
 * is that a candidate can tell which is which (`CLAUDE.md`: never let a general pattern
 * be presented as a specific report).
 */
export function LoopBriefStep({
  companyName,
  roleTitle,
  accessToken,
  onChooseRound,
  onSkip,
}: {
  companyName: string;
  roleTitle: string;
  accessToken: string | null | undefined;
  onChooseRound: (roundType: RoundType) => void;
  onSkip: () => void;
}) {
  const [brief, setBrief] = useState<LoopBrief | null>(null);
  const [plan, setPlan] = useState<PrepPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    const query = { company: companyName, role: roleTitle };

    fetchLoopBrief(query, { accessToken })
      .then((result) => active && setBrief(result))
      .catch((cause) => {
        if (!active) return;
        setError(
          cause instanceof ApiRequestError
            ? cause.message
            : "We could not read that company's loop just now.",
        );
      });
    fetchPrepPlan(query, { accessToken })
      .then((result) => active && setPlan(result))
      .catch(() => {
        /* The brief renders on its own; a plan that fails to load just leaves no plan shown. */
      });

    return () => {
      active = false;
    };
  }, [accessToken, companyName, roleTitle]);

  const firstPlanItem = plan?.items[0] ?? null;

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="self-start text-body text-accent underline-offset-4 hover:underline"
        >
          Set the round up myself instead
        </button>
      </div>
    );
  }

  if (!brief) {
    return <p className="text-body text-ink-muted">Reading how {companyName} interviews…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {roleTitle} at {brief.company.name}
        </p>
        <h1 className="text-title text-balance text-ink">
          How {brief.company.name} interviews for {roleTitle}
        </h1>
        {brief.company.archetypeConfidence === "inferred" ? (
          <p className="max-w-prose text-body text-ink-muted">
            We don&apos;t know {brief.company.name} specifically, so this runs on{" "}
            {brief.company.archetypeInProse} — the closest pattern, not a claim about this
            employer.
          </p>
        ) : null}
      </header>

      {brief.hasSources ? (
        <ol className="flex flex-col gap-5 border-l border-line pl-6">
          {brief.sourcedStages.map((stage, index) => (
            <li key={`${stage.stageName}-${index}`} className="flex flex-col gap-1.5">
              <p className="font-mono text-micro tracking-widest text-accent uppercase">
                From {stage.citations[0]?.publisher ?? brief.company.name}&apos;s own record
              </p>
              <p className="text-body font-medium text-ink">{stage.stageName}</p>
              {stage.assesses ? <p className="text-caption text-ink-muted">{stage.assesses}</p> : null}
              <p className="flex flex-wrap gap-x-2 text-caption text-ink-subtle">
                {stage.citations.map((citation, citationIndex) => (
                  <span key={citation.url ?? citation.title}>
                    {citationIndex > 0 ? " · " : null}
                    {citation.url ? (
                      <a href={citation.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                        {citation.title}
                      </a>
                    ) : (
                      citation.title
                    )}
                    {citation.year ? `, ${citation.year}` : null}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="max-w-prose text-body text-ink-muted">
          We don&apos;t hold a sourced account of {brief.company.name}&apos;s process yet. What
          follows is the usual pattern for {brief.company.archetypeInProse} — not a claim about
          this employer specifically.
        </p>
      )}

      {brief.generalPattern.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-line pt-6">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Usual for {brief.company.archetypeInProse} — not a claim about {brief.company.name}
          </p>
          <ol className="flex flex-col gap-2">
            {brief.generalPattern.map((stage) => (
              <li key={stage.order} className="text-body text-ink-muted">
                <span className="text-ink">{stage.stageName}.</span> {stage.assesses}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Question bank
        </p>
        <p className="text-body text-ink-muted">
          {brief.bankCoverage.questionCount > 0 ? (
            <>
              {brief.bankCoverage.questionCount} sourced question
              {brief.bankCoverage.questionCount === 1 ? "" : "s"} for {brief.company.name}.{" "}
              {brief.bankCoverage.bankUrl ? (
                <Link href={brief.bankCoverage.bankUrl} className="text-accent underline-offset-4 hover:underline">
                  See them
                </Link>
              ) : null}
            </>
          ) : (
            <>Nothing sourced for {brief.company.name} in the bank yet.</>
          )}
        </p>
      </section>

      {plan && plan.items.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-line pt-6">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">The plan</p>
          <ol className="flex flex-col gap-4">
            {plan.items.map((item) => (
              <li key={item.roundType} className="flex flex-col gap-1">
                <p className="text-body font-medium text-ink">
                  {item.roundLabel} · {item.suggestedMinutes} min
                </p>
                <p className="text-caption text-ink-muted">{item.why}</p>
                {item.focusAreas.length > 0 ? (
                  <p className="text-caption text-ink-subtle">Focus: {item.focusAreas.join(", ")}</p>
                ) : null}
              </li>
            ))}
          </ol>
          {plan.unsimulatedStages.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-sunken p-4">
              <p className="text-caption font-medium text-ink">Not part of a spoken round</p>
              {plan.unsimulatedStages.map((stage) => (
                <p key={stage.stageName} className="text-caption text-ink-muted">
                  <span className="text-ink">{stage.stageName}:</span> {stage.note}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-line pt-6">
        <div className="flex flex-wrap items-center gap-4">
          {firstPlanItem ? (
            <button
              type="button"
              onClick={() => onChooseRound(firstPlanItem.roundType)}
              className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-white hover:opacity-90"
            >
              Start with {firstPlanItem.roundLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-white hover:opacity-90"
            >
              Set up a round
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="text-body text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            I know the loop — let me pick
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-caption text-ink-subtle">Or any other round, of any kind:</p>
          <ul className="flex flex-wrap gap-2">
            {ROUND_CATALOGUE.map((round) => (
              <li key={round.value}>
                <button
                  type="button"
                  onClick={() => onChooseRound(round.value)}
                  className="rounded-full border border-line px-3.5 py-1.5 text-caption text-ink-muted hover:border-accent hover:text-ink"
                >
                  {round.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
