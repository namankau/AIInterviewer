"use client";

import type {
  ReportAssessedArea,
  ReportAssistance,
  ReportQuestionSources,
  SessionReport,
} from "@acemyinterview/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CompetencyBars, OverallScore } from "@/components/report-charts";
import { ApiRequestError, fetchReport } from "@/lib/api";
import { cn } from "@/lib/cn";
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
  const [expired, setExpired] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    fetchReport(sessionId, { accessToken })
      .then((loaded) => active && setReport(loaded))
      .catch((cause) => {
        if (!active) return;
        // A report past its retention window is not a failure, and rendering it in red
        // as one would tell the candidate something had gone wrong at the moment the
        // product did exactly what it said it would. The API marks it out with its own
        // code so this page does not have to read the message to know the difference.
        if (cause instanceof ApiRequestError && cause.code === "report_expired") {
          setExpired(cause.message);
          return;
        }
        setError(cause instanceof ApiRequestError ? cause.message : "This report could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [accessToken, sessionId]);

  if (expired) {
    return (
      <section aria-labelledby="expired" className="flex flex-col items-start gap-5">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          No longer held
        </p>
        <h1 id="expired" className="max-w-2xl text-display text-balance text-ink">
          This report has expired.
        </h1>
        <p className="max-w-prose text-body text-ink-muted">{expired}</p>
        <p className="max-w-prose text-body text-ink-muted">
          The round itself is still in your history. Sitting the same round again is the closest
          thing to reading it back — and a second attempt tells you more than the first one did.
        </p>
        <div className="flex flex-wrap items-center gap-5 pt-1">
          <Link
            href="/interview/new"
            className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
          >
            Sit this round again
          </Link>
          <Link href="/dashboard" className="text-body text-ink-muted underline-offset-4 hover:underline">
            Back to your interviews
          </Link>
        </div>
      </section>
    );
  }

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

  return <ReportDocument report={report} />;
}

/**
 * The report as pure markup over a report it is handed.
 *
 * Split from the fetching for the same reason the dashboard was: a page reachable only by
 * signing in, sitting a full round and waiting for a model to write about it is a page
 * nobody ever looks at twice, and the visuals on it have to be looked at to be judged.
 *
 * Every array is read through `?? []`. Reports are composed once and stored, so a report
 * written before a section existed comes back without its key — which is not theoretical:
 * an interview sat one week could not be opened at all the next, because the reader hit
 * `.length` on a field that had just been added. The server backfills the shape it knows
 * about (`ReportService.withEveryField`), and this is the belt to that pair of braces.
 */
export function ReportDocument({ report }: { report: SessionReport }) {
  const competencies = report.competencies ?? [];
  const annotations = report.annotations ?? [];
  const practicePlan = report.practicePlan ?? [];
  const strengths = report.strengths ?? [];
  const developmentAreas = report.developmentAreas ?? [];

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

      {/*
        * The anchor, and the first thing under the headline. It is deliberately not in a
        * panel: the three bordered blocks further down are asides, and this is the page's
        * own voice, so it sits on the sheet at the size the number deserves.
        */}
      <OverallScore competencies={competencies} />

      {report.assistance ? <AssistancePanel assistance={report.assistance} /> : null}

      <Section title="Competencies" lead="Each score is anchored to something you actually said.">
        {competencies.length === 0 ? (
          <p className="text-body text-ink-muted">
            No competency could be scored against evidence from this transcript. That usually means
            the answers were too brief to assess fairly.
          </p>
        ) : (
          <>
            <CompetencyBars competencies={competencies} />

            <ul className="flex flex-col gap-8 border-t border-line pt-8">
              {competencies.map((item) => (
                <li key={item.competency} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-heading text-ink">{item.competency}</h3>
                    <span className="shrink-0 font-mono text-caption tabular-nums text-ink-muted">
                      {item.score}/{item.maxScore}
                    </span>
                  </div>
                  {/*
                    * No bar here. The chart above compares all of them against the same
                    * datum, which is the only way the comparison is worth anything; a
                    * second copy of one bar in isolation would say less and claim more.
                    */}
                  <p className="max-w-prose text-body text-ink-muted">{item.rationale}</p>
                  <blockquote className="border-l-2 border-accent pl-4 text-body text-ink italic">
                    &ldquo;{item.evidenceQuote}&rdquo;
                  </blockquote>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {annotations.length > 0 ? (
        <Section
          title="Answer by answer"
          lead="Every question you were asked, and how you could have answered it better."
        >
          <ol className="flex flex-col gap-10">
            {annotations.map((note, index) => (
              <li
                key={`${note.turnIndex}-${index}`}
                className="flex flex-col gap-4 border-t border-line pt-8 first:border-0 first:pt-0"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                    question {note.turnIndex + 1}
                  </span>
                </div>
                <p className="text-body font-medium text-ink">{note.question}</p>

                {/*
                  * The load-bearing part of this section, so it is the one thing that
                  * cannot be quiet: a candidate who reads nothing else on this page should
                  * still leave with this. Rendered even for an older stored report that
                  * has no note for this question — an honest "no note" beats the question
                  * silently vanishing from the list.
                  */}
                <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-surface-raised p-5">
                  <span className="font-mono text-micro tracking-widest text-accent uppercase">
                    How you could have answered it better
                  </span>
                  <p className="max-w-prose text-body text-ink">
                    {note.strongerFraming ?? "No note was written for this answer."}
                  </p>
                </div>

                {note.worked || note.vague || note.wouldProbe ? (
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <Note term="What worked" detail={note.worked} />
                    <Note term="What was vague" detail={note.vague} />
                    <Note term="Where they'd have probed" detail={note.wouldProbe} />
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>
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

      <AssessedAreas strengths={strengths} developmentAreas={developmentAreas} />

      <QuestionSources sources={report.questionSources} />

      {practicePlan.length > 0 ? (
        <Section title="What to work on" lead="Before the next attempt, in this order.">
          <ol className="flex flex-col gap-6">
            {practicePlan.map((item, index) => (
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
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised shadow-[var(--shadow-sm)] p-6">
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
          className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
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
  const breakdown = assistance.breakdown ?? [];
  const moments = assistance.moments ?? [];

  return (
    <section
      aria-labelledby="assistance"
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised shadow-[var(--shadow-sm)] p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="assistance" className="text-heading text-ink">
          {unaided ? "You did this unaided" : "Where you needed a hand"}
        </h2>
        <p className="text-caption text-ink-subtle">{assistance.headline}</p>
      </div>

      {breakdown.length > 0 ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {breakdown.map((item) => (
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

      {moments.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-4">
          {moments.map((moment) => (
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
 * What held up and what did not, beside each other rather than forty lines apart.
 *
 * They used to be two sections in sequence, which meant the strengths were read, then
 * scrolled past, then the weaknesses were read on their own — and a page of weaknesses
 * with the good news off screen is a harsher report than the one that was written. Set
 * side by side they read as the single assessment they are, and the two column rules do
 * the telling apart without either list having to shout.
 *
 * Both columns are rendered whenever either has anything in it, empty one included. An
 * absent column would silently turn a split into a verdict — a candidate seeing only the
 * right-hand list has no way to know whether the left was empty or was never drawn.
 */
function AssessedAreas({
  strengths,
  developmentAreas,
}: {
  strengths: ReportAssessedArea[];
  developmentAreas: ReportAssessedArea[];
}) {
  if (strengths.length === 0 && developmentAreas.length === 0) return null;

  return (
    <Section
      title="What held up, and what did not"
      lead="Named plainly, because a soft report is a real rejection later."
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <AreaColumn
          heading="What held up"
          tone="positive"
          areas={strengths}
          empty="Nothing in this round could be quoted as a strength. That is a finding about the round, not about you — a short answer leaves nothing to point at."
        />
        <AreaColumn
          heading="What did not"
          tone="critical"
          areas={developmentAreas}
          empty="Nothing in this round was weak enough to name against a quote."
        />
      </div>
    </Section>
  );
}

/**
 * One side of the split: what it was, the words that show it, why it matters at this
 * level, and one thing to do. The quote is the load-bearing part — anything without one
 * was dropped server-side before it reached here.
 */
function AreaColumn({
  heading,
  tone,
  areas,
  empty,
}: {
  heading: string;
  tone: "positive" | "critical";
  areas: ReportAssessedArea[];
  empty: string;
}) {
  const rule = tone === "positive" ? "border-positive" : "border-danger";

  return (
    <section aria-label={heading} className="flex flex-col gap-5">
      <div className={cn("flex items-baseline justify-between gap-3 border-t-2 pt-3", rule)}>
        <h3 className="text-heading text-ink">{heading}</h3>
        <span className="shrink-0 font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {areas.length} {areas.length === 1 ? "thing" : "things"}
        </span>
      </div>

      {areas.length === 0 ? (
        <p className="max-w-prose text-body text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {areas.map((item) => (
            <li key={item.area} className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <h4 className="text-body font-medium text-ink">{item.area}</h4>
                {item.turnIndex !== null ? (
                  <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                    question {item.turnIndex + 1}
                  </span>
                ) : null}
              </div>

              <blockquote className={cn("border-l-2 pl-4 text-body text-ink-muted italic", rule)}>
                &ldquo;{item.evidenceQuote}&rdquo;
              </blockquote>

              <dl className="flex flex-col gap-3">
                <Note term="Why it matters" detail={item.whyItMatters} />
                <Note term="What to do" detail={item.whatToDo} />
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Where the questions came from.
 *
 * The disclosure is not a footnote to be tucked away — it is the reason this section can
 * be believed. Only a question the server matched to the question bank carries `sources`
 * and the `published_source` tier; follow-ups and model-written questions say they are
 * general knowledge, and the page says which is which before it shows anything else. A
 * candidate who reads "asked at Google in March", checks, and finds nothing will never
 * trust this report again, and they would be right.
 */
function QuestionSources({ sources }: { sources: ReportQuestionSources | undefined }) {
  // A report written before provenance existed has no sources section at all.
  const entries = sources?.entries ?? [];
  if (!sources || entries.length === 0) return null;

  return (
    <Section title="Why you were asked these" lead={sources.headline}>
      <p className="max-w-prose rounded-lg border border-line bg-surface-sunken p-4 text-caption text-ink-muted">
        {sources.disclosure}
      </p>

      <ol className="flex flex-col divide-y divide-line border-y border-line">
        {entries.map((entry) => (
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
              {/* A pool question has no basis beside its label, which arrives as the disclosure. */}
              {entry.basis ? <p className="max-w-prose text-caption text-ink-muted">{entry.basis}</p> : null}
              <p className="max-w-prose text-caption text-ink-subtle">{entry.tierDisclosure}</p>
            </div>

            {(entry.sources ?? []).length > 0 ? (
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
