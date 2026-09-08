"use client";

import type {
  ReportAssessedArea,
  ReportAssistance,
  ReportQuestionSources,
  SessionReport,
} from "@acemyinterview/shared";
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

      {report.assistance ? <AssistancePanel assistance={report.assistance} /> : null}

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

      {(report.strengths ?? []).length > 0 ? (
        <Section title="What held up" lead="With the words that show it.">
          <AreaList areas={report.strengths ?? []} tone="positive" />
        </Section>
      ) : null}

      {(report.developmentAreas ?? []).length > 0 ? (
        <Section title="What did not" lead="Named plainly, because a soft report is a real rejection later.">
          <AreaList areas={report.developmentAreas ?? []} tone="critical" />
        </Section>
      ) : null}

      <QuestionSources sources={report.questionSources} />

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

/**
 * How much the interviewer stepped in.
 *
 * Shown high in the report and stated plainly, because a candidate who was hinted to the
 * answer deserves to know that is what happened — a report that quietly folds assisted
 * answers into the same score as unaided ones is flattering them into a real rejection.
 */
function AssistancePanel({ assistance }: { assistance: ReportAssistance }) {
  const unaided = assistance.assistedAnswers === 0;

  return (
    <section
      aria-labelledby="assistance"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="assistance" className="text-heading text-ink">
          {unaided ? "You did this unaided" : "Where you needed a hand"}
        </h2>
        <p className="text-caption text-ink-subtle">{assistance.headline}</p>
      </div>

      {assistance.breakdown.length > 0 ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {assistance.breakdown.map((item) => (
            <li key={item.label} className="text-caption text-ink-muted">
              {item.label}
              <span className="pl-2 font-mono text-ink-subtle">×{item.count}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {assistance.narrative ? (
        <p className="max-w-prose text-body text-ink-muted">{assistance.narrative}</p>
      ) : null}

      {assistance.moments.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-4">
          {assistance.moments.map((moment) => (
            <li key={moment} className="text-caption text-ink-subtle">
              — {moment}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * A strength or a weakness: what it was, the words that show it, why it matters at this
 * level, and one thing to do. The quote is the load-bearing part — anything without one
 * was dropped server-side before it reached here.
 */
function AreaList({
  areas,
  tone,
}: {
  areas: ReportAssessedArea[];
  tone: "positive" | "critical";
}) {
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line">
      {areas.map((item) => (
        <li key={item.area} className="flex flex-col gap-3 py-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="text-heading text-ink">{item.area}</h3>
            {item.turnIndex !== null ? (
              <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                question {item.turnIndex + 1}
              </span>
            ) : null}
          </div>

          <blockquote
            className={`border-l-2 pl-4 text-body italic ${
              tone === "positive" ? "border-positive text-ink-muted" : "border-danger text-ink-muted"
            }`}
          >
            &ldquo;{item.evidenceQuote}&rdquo;
          </blockquote>

          <dl className="grid gap-3 sm:grid-cols-2">
            <Note term="Why it matters" detail={item.whyItMatters} />
            <Note term="What to do" detail={item.whatToDo} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

/**
 * Where the questions came from.
 *
 * The disclosure is not a footnote to be tucked away — it is the reason this section can
 * be believed. Every question today is written from the model's general knowledge of an
 * employer archetype, with no retrieved sources behind it, and the page says so before it
 * shows anything else. A candidate who reads "asked at Google in March", checks, and
 * finds nothing will never trust this report again, and they would be right.
 *
 * When a real corpus exists, `sources` fills in per question and the disclosure changes
 * with the tier. Nothing else here has to move.
 */
function QuestionSources({ sources }: { sources: ReportQuestionSources | undefined }) {
  // A report written before provenance existed has no sources section at all.
  if (!sources || (sources.entries ?? []).length === 0) return null;

  return (
    <Section title="Why you were asked these" lead={sources.headline}>
      <p className="max-w-prose rounded-lg border border-line bg-surface-sunken p-4 text-caption text-ink-muted">
        {sources.disclosure}
      </p>

      <ol className="flex flex-col divide-y divide-line border-y border-line">
        {sources.entries.map((entry) => (
          <li key={entry.turnIndex} className="flex flex-col gap-3 py-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                question {entry.turnIndex + 1}
              </span>
              {entry.phase === "warmup" ? (
                <span className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-micro text-ink-subtle">
                  warm-up
                </span>
              ) : null}
            </div>

            <p className="max-w-prose text-body text-ink">{entry.question}</p>

            <dl className="grid gap-3 sm:grid-cols-2">
              <Note term="What it was testing" detail={entry.probes} />
              <Note term="Why you got it" detail={entry.askedBecause} />
            </dl>

            <div className="flex flex-col gap-1 border-l-2 border-line-strong pl-4">
              <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                Basis
              </span>
              <p className="max-w-prose text-caption text-ink-muted">{entry.basis}</p>
              <p className="max-w-prose text-caption text-ink-subtle">{entry.tierDisclosure}</p>
            </div>

            {entry.sources.length > 0 ? (
              <ul className="flex flex-col gap-1 pl-4">
                {entry.sources.map((source) => (
                  <li key={`${source.title}-${source.url ?? ""}`} className="text-caption text-ink-muted">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                    {source.publisher ? ` · ${source.publisher}` : ""}
                    {source.year ? ` · ${source.year}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
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
