"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiRequestError, fetchReport } from "@/lib/api";
import { rememberReport } from "@/lib/report-cache";
import { useAccessToken } from "@/lib/use-access-token";

const POLL_DELAY_MS = 3_000;
const WAIT_LIMIT_MS = 10 * 60_000;
const STEP_INTERVAL_MS = 7_000;
const VERB_INTERVAL_MS = 2_400;

/**
 * What the analysis is doing, in order. The API reports only "still writing" or "done",
 * so the list advances on a clock and the last step holds until the report is actually
 * saved — it is never marked finished before the report exists.
 */
const STEPS = [
  "Reading your transcript",
  "Matching evidence to the words you used",
  "Scoring each competency",
  "Writing your next practice plan",
] as const;

const VERBS = [
  "Grilling your answers",
  "Cross-examining the transcript",
  "Weighing the evidence",
  "Pressure-testing your reasoning",
  "Hunting for strong moments",
  "Spotting the gaps",
  "Drafting your plan",
] as const;

type Phase =
  | { status: "analysing" }
  | { status: "ready" }
  | { status: "slow" }
  | { status: "failed"; message: string };

function stillGenerating(cause: unknown): boolean {
  return (
    cause instanceof ApiRequestError &&
    ((cause.status === 409 && cause.code === "report_generating") || cause.status === 502 || cause.status === 504)
  );
}

/**
 * The handoff from interview to feedback.
 *
 * The report is written the first time anybody asks for it, and writing it takes a model
 * call. This screen used to offer "Read the report" straight away, so that wait started
 * only once the candidate clicked — and then happened on a blank report page. Asking here
 * instead starts the work the moment the round ends, shows it happening, and offers the
 * report only once it exists; the report page then opens from what this screen loaded.
 */
export function InterviewCompletePanel({ sessionId }: { sessionId: string }) {
  const accessToken = useAccessToken();
  const [phase, setPhase] = useState<Phase>({ status: "analysing" });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const startedAt = Date.now();

    const load = async () => {
      try {
        const report = await fetchReport(sessionId, { accessToken, signal: controller.signal });
        rememberReport(sessionId, report);
        if (active) setPhase({ status: "ready" });
      } catch (cause) {
        if (!active) return;
        if (stillGenerating(cause)) {
          if (Date.now() - startedAt >= WAIT_LIMIT_MS) {
            setPhase({ status: "slow" });
            return;
          }
          timer = setTimeout(load, POLL_DELAY_MS);
          return;
        }
        setPhase({
          status: "failed",
          message: cause instanceof ApiRequestError ? cause.message : "Your report could not be prepared here.",
        });
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [accessToken, sessionId]);

  const analysing = phase.status === "analysing";
  useEffect(() => {
    if (!analysing) return;
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [analysing]);

  const ready = phase.status === "ready";
  const activeStep = ready ? STEPS.length : Math.min(Math.floor((elapsed * 1000) / STEP_INTERVAL_MS), STEPS.length - 1);
  const verb = VERBS[Math.floor((elapsed * 1000) / VERB_INTERVAL_MS) % VERBS.length];
  const reportHref = `/report/${sessionId}` as Route;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-tint px-6 py-12">
      <section aria-labelledby="interview-complete" className="w-full max-w-4xl text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-accent-contrast shadow-[var(--shadow-md)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-7">
            <path d="m6.5 12 3.5 3.5L17.5 8" />
          </svg>
        </span>
        <p className="eyebrow mt-5 text-accent">Interview complete</p>
        <h1 id="interview-complete" className="mt-3 text-display text-balance text-ink">
          That&rsquo;s the end of the round.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-body leading-relaxed text-ink-muted">
          Your report turns what you actually said and built into evidence, patterns and a focused next practice plan.
        </p>

        <ul className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          {[
            ["01", "Competency breakdown", "See the signals the round could support."],
            ["02", "Evidence from your answers", "Feedback stays tied to words you actually used."],
            ["03", "Your next practice plan", "Leave with specific work, not a generic score."],
          ].map(([number, title, detail]) => (
            <li key={number} className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)]">
              <span className="font-mono text-micro font-semibold text-accent">{number}</span>
              <p className="mt-2 text-caption font-semibold text-ink">{title}</p>
              <p className="mt-1 text-caption leading-relaxed text-ink-muted">{detail}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-2xl border border-line bg-surface-raised p-5 text-left shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-4">
            <div role="status" aria-live="polite" className="flex min-w-0 items-center gap-3">
              {ready ? (
                <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-positive text-positive-contrast">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3">
                    <path d="m6.5 12 3.5 3.5L17.5 8" />
                  </svg>
                </span>
              ) : (
                <span aria-hidden className="size-5 shrink-0 rounded-full border-2 border-accent/25 border-t-accent motion-safe:animate-spin" />
              )}
              <p className="text-caption font-semibold text-ink">
                {ready
                  ? "Your report is ready"
                  : phase.status === "failed"
                    ? "The report could not be prepared here"
                    : phase.status === "slow"
                      ? "This is taking longer than usual"
                      : "Analysing your interview"}
              </p>
            </div>
            {analysing ? (
              <span aria-hidden className="shrink-0 font-mono text-micro text-ink-subtle">
                {verb}… · {elapsed}s
              </span>
            ) : null}
          </div>

          <ol className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
            {STEPS.map((step, index) => {
              const done = index < activeStep;
              const current = index === activeStep && analysing;
              return (
                <li key={step} className={`flex items-center gap-3 text-caption ${done || current ? "text-ink" : "text-ink-subtle"}`}>
                  <span aria-hidden className="grid size-4 shrink-0 place-items-center">
                    {done ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-4 text-positive">
                        <path d="m6.5 12 3.5 3.5L17.5 8" />
                      </svg>
                    ) : current ? (
                      <span className="size-2 rounded-full bg-accent motion-safe:animate-pulse" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-line" />
                    )}
                  </span>
                  <span className={current ? "font-semibold" : undefined}>{step}</span>
                </li>
              );
            })}
          </ol>
          {phase.status === "failed" ? <p className="mt-4 text-caption text-ink-muted">{phase.message}</p> : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {ready ? (
            <Link href={reportHref} className="action-primary min-h-12 px-6 text-body">
              Read the report <span aria-hidden="true">→</span>
            </Link>
          ) : phase.status === "analysing" ? null : (
            <Link href={reportHref} className="action-primary min-h-12 px-6 text-body">
              Open the report page <span aria-hidden="true">→</span>
            </Link>
          )}
          <Link href="/dashboard" className="action-secondary min-h-12 px-5 text-body">
            Back to dashboard
          </Link>
        </div>
        {analysing ? (
          <p className="mx-auto mt-4 max-w-2xl text-caption leading-relaxed text-ink-subtle">
            You can leave this page — the report keeps being written, and it will be waiting on your dashboard.
          </p>
        ) : null}
      </section>
    </div>
  );
}
