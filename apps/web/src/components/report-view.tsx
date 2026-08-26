"use client";

import type { SessionReport } from "@interviewos/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiRequestError, fetchReport } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * The feedback report (PRD 09) — where perceived value concentrates.
 *
 * Every competency score is shown with the candidate's own words underneath it. Scores
 * arrive here already filtered server-side: any whose evidence could not be found in the
 * transcript was dropped rather than displayed, because a score without evidence is a
 * badge, and an invented quote destroys the credibility this page exists to build.
 */
export function ReportView({ sessionId }: { sessionId: string }) {
  const accessToken = useAccessToken();
  const [report, setReport] = useState<SessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    fetchReport(sessionId, { accessToken })
      .then((loaded) => active && setReport(loaded))
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof ApiRequestError ? cause.message : "This report could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [accessToken, sessionId]);

  if (error) {
    return (
      <p role="alert" className="text-body text-danger">
        {error}
      </p>
    );
  }

  if (!report) {
    return (
      <p role="status" className="text-body text-ink-muted">
        Putting your report together…
      </p>
    );
  }

  return (
    <article className="flex flex-col gap-16">
      <header className="flex flex-col gap-4 border-b border-line pb-10">
        <p className="text-caption tracking-wide text-ink-subtle uppercase">
          {report.roundLabel} · {report.companyName}
        </p>
        <h1 className="text-display text-balance text-ink">{report.headline}</h1>
        <p className="max-w-prose text-body text-ink-muted">{report.summary}</p>
        <p className="text-caption text-ink-subtle">
          {report.roleTitle} · {report.answeredTurns} answers · assessed against a{" "}
          {report.archetypeLabel.toLowerCase()} rubric
        </p>
      </header>

      <Section title="Competencies" lead="Each score is anchored to something you actually said.">
        {report.competencies.length === 0 ? (
          <p className="text-body text-ink-muted">
            No competency could be scored against evidence from this transcript. That usually means
            the answers were too brief to assess fairly.
          </p>
        ) : (
          <ul className="flex flex-col gap-8">
            {report.competencies.map((item) => (
              <li key={item.competency} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-heading text-ink">{item.competency}</h3>
                  <span className="shrink-0 font-mono text-caption text-ink-muted">
                    {item.score}/{item.maxScore}
                  </span>
                </div>
                <ScoreBar score={item.score} max={item.maxScore} competency={item.competency} />
                <p className="max-w-prose text-body text-ink-muted">{item.rationale}</p>
                <blockquote className="border-l-2 border-accent pl-4 text-body text-ink italic">
                  &ldquo;{item.evidenceQuote}&rdquo;
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {report.annotations.length > 0 ? (
        <Section title="Answer by answer" lead="What a real interviewer would have made of each one.">
          <ul className="flex flex-col gap-10">
            {report.annotations.map((note) => (
              <li key={note.turnIndex} className="flex flex-col gap-3">
                <p className="text-body font-medium text-ink">{note.question}</p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Note term="What worked" detail={note.worked} />
                  <Note term="What was vague" detail={note.vague} />
                  <Note term="Where they'd have probed" detail={note.wouldProbe} />
                  <Note term="A stronger framing" detail={note.strongerFraming} />
                </dl>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="How you came across" lead="Delivery, separately from content.">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Note term="Structure" detail={report.communication.structure} />
          <Note term="Filler" detail={report.communication.fillerDensity} />
          <Note term="Pace" detail={report.communication.pace} />
          <Note term="Rambling" detail={report.communication.rambling} />
          <Note term="Not knowing an answer" detail={report.communication.handlingUncertainty} />
        </dl>
      </Section>

      {report.practicePlan.length > 0 ? (
        <Section title="What to work on" lead="Before the next attempt, in this order.">
          <ol className="flex flex-col gap-6">
            {report.practicePlan.map((item, index) => (
              <li key={item.focus} className="flex gap-4">
                <span className="pt-0.5 font-mono text-caption text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-body font-medium text-ink">{item.focus}</h3>
                  <p className="max-w-prose text-body text-ink-muted">{item.why}</p>
                  <p className="max-w-prose text-caption text-ink-subtle">{item.drill}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      <Section title="If this had been the real thing" lead="A simulation, not a verdict.">
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-6">
          <div className="flex items-baseline gap-3">
            <span className="text-heading text-ink">{report.outcomeSimulation.label}</span>
            <span className="text-caption text-ink-subtle">{report.outcomeSimulation.likelihood}</span>
          </div>
          <p className="max-w-prose text-body text-ink-muted">{report.outcomeSimulation.reasoning}</p>
          <p className="pt-2 text-caption text-ink-subtle">
            This is a simulation based on one practice round. It is not a prediction, and no real
            employer has seen it.
          </p>
        </div>
      </Section>

      <footer className="flex flex-wrap items-center gap-4 border-t border-line pt-10">
        <Link
          href="/interview/new"
          className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
        >
          Practise again
        </Link>
        <p className="text-caption text-ink-subtle">
          Recommended next: {report.recommendedNextSession}
        </p>
      </footer>
    </article>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-title text-ink">{title}</h2>
        <p className="text-caption text-ink-subtle">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Note({ term, detail }: { term: string; detail: string | null }) {
  if (!detail) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-ink-subtle">{term}</dt>
      <dd className="text-body text-ink-muted">{detail}</dd>
    </div>
  );
}

function ScoreBar({ score, max, competency }: { score: number; max: number; competency: string }) {
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${competency}: ${score} out of ${max}`}
      className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}
