"use client";

import type { LoopBrief, PrepPlan, RoundType } from "@acemyinterview/shared";
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
 *
 * The honesty caveat — this is an archetype guess, not a claim about the named employer
 * — is said exactly once, wherever it is most true for this company, rather than once
 * per section. Repeating it is how the one that matters gets skipped.
 */
export function LoopBriefStep({
  companyName,
  roleTitle,
  accessToken,
  onChooseRound,
  onSkip,
  onEdit,
}: {
  companyName: string;
  roleTitle: string;
  accessToken: string | null | undefined;
  onChooseRound: (roundType: RoundType) => void;
  onSkip: () => void;
  onEdit: () => void;
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

  // One honesty caveat, wherever it is truest for this company. If we don't even
  // recognise the archetype, that is the caveat. Otherwise, if we recognise the
  // archetype but hold no sourced account, that is. If we hold sources, the sourced
  // stages speak for themselves and the general-pattern section labels itself.
  const caveat = brief
    ? brief.company.archetypeConfidence === "inferred"
      ? `We don't know ${brief.company.name} specifically, so this runs on ${brief.company.archetypeInProse} — the closest pattern, not a claim about this employer.`
      : !brief.hasSources
        ? `We don't hold a sourced account of ${brief.company.name}'s process yet — what follows is the usual pattern for ${brief.company.archetypeInProse}, not a claim about this employer specifically.`
        : null
    : null;

  // A sourced stage with nothing to say (no `assesses`) doesn't earn its own block —
  // but the source it cites is still real, so it isn't discarded either. It's folded
  // into one quiet line instead.
  const contentfulSourcedStages = brief?.sourcedStages.filter((stage) => stage.assesses) ?? [];
  const quietSourcedStages = brief?.sourcedStages.filter((stage) => !stage.assesses) ?? [];

  if (error) {
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-danger/25 bg-danger/5 p-6">
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
    return (
      <p className="rounded-2xl border border-line bg-surface-raised p-6 text-body text-ink-muted shadow-[var(--shadow-sm)]">
        Reading how {companyName} interviews…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-[1.5rem] bg-navy p-7 text-on-navy shadow-[var(--shadow-md)] sm:p-9">
        <div aria-hidden="true" className="absolute -top-20 -right-14 size-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex flex-col gap-3">
        <p className="pill pill-navy w-fit">
          {roleTitle} at {brief.company.name}
        </p>
        <h1 className="text-title text-balance text-on-navy">
          How {brief.company.name} interviews for {roleTitle}
        </h1>
        {caveat ? <p className="max-w-prose text-body text-on-navy-muted">{caveat}</p> : null}
        <button
          type="button"
          onClick={onEdit}
          className="self-start text-caption text-on-navy-muted underline-offset-4 hover:text-on-navy hover:underline"
        >
          Edit the description this was built from
        </button>
        </div>
      </header>

      {contentfulSourcedStages.length > 0 ? (
        <ol className="grid gap-3 sm:grid-cols-2">
          {contentfulSourcedStages.map((stage, index) => (
            <li
              key={`${stage.stageName}-${index}`}
              className="flex flex-col gap-2 rounded-2xl border border-positive/20 bg-positive/5 p-5"
            >
              <p className="font-mono text-micro tracking-widest text-accent uppercase">
                From {stage.citations[0]?.publisher ?? brief.company.name}&apos;s own record
              </p>
              <p className="text-body font-medium text-ink">{stage.stageName}</p>
              <p className="text-caption text-ink-muted">{stage.assesses}</p>
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
      ) : null}

      {quietSourcedStages.length > 0 ? (
        <p className="text-caption text-ink-subtle">
          Based in part on:{" "}
          {quietSourcedStages.map((stage, index) => (
            <span key={`${stage.stageName}-${index}`}>
              {index > 0 ? "; " : null}
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
                </span>
              ))}
            </span>
          ))}
        </p>
      ) : null}

      {brief.generalPattern.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            General pattern for {brief.company.archetypeInProse}
          </p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {brief.generalPattern.map((stage) => (
              <li key={stage.order} className="rounded-xl bg-surface-sunken p-4 text-body text-ink-muted">
                <span className="text-ink">{stage.stageName}.</span> {stage.assesses}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {plan && plan.items.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-accent/25 bg-accent-wash p-6">
          <p className="pill pill-accent w-fit">The plan</p>
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

      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-4">
          {firstPlanItem ? (
            <button
              type="button"
              onClick={() => onChooseRound(firstPlanItem.roundType)}
              className="rounded-xl bg-accent px-5 py-3 text-body font-semibold text-accent-contrast shadow-[var(--shadow-sm)] hover:bg-accent-strong"
            >
              Start with {firstPlanItem.roundLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl bg-accent px-5 py-3 text-body font-semibold text-accent-contrast shadow-[var(--shadow-sm)] hover:bg-accent-strong"
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
                  className="rounded-full border border-line bg-surface px-3.5 py-2 text-caption text-ink-muted transition-colors hover:border-accent hover:bg-accent-wash hover:text-ink"
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
