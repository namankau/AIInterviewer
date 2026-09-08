"use client";

import type { EntitlementView, ReadinessGroup, SessionSummary } from "@acemyinterview/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchEntitlement, fetchReadiness, fetchSessions } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * The dashboard's job is to start the next interview, so there is one primary action and
 * nothing competing with it. History and readiness sit below, as evidence rather than
 * as scores to collect.
 *
 * The composition was the thing wrong with it. Everything was set within one step of
 * `text-body`, in a single 768px column pinned to the left of the window, so the most
 * consequential number on the page — how a candidate is actually doing — was rendered in
 * the smallest type on it, and the right-hand half of the screen held nothing. That is
 * not restraint; restraint is a decision about what to leave out, and this was an absence
 * of decisions. There is a real scale now, and the page is composed across the width it
 * has: the score is the largest thing here after the heading, because it is the most
 * important thing here after the heading.
 */
export function DashboardPanel() {
  const accessToken = useAccessToken();
  const [entitlement, setEntitlement] = useState<EntitlementView | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [readiness, setReadiness] = useState<ReadinessGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    Promise.allSettled([
      fetchEntitlement({ accessToken }),
      fetchSessions({ accessToken }),
      fetchReadiness({ accessToken }),
    ]).then(([ent, list, ready]) => {
      if (!active) return;
      if (ent.status === "fulfilled") setEntitlement(ent.value);
      if (list.status === "fulfilled") setSessions(list.value);
      if (ready.status === "fulfilled") setReadiness(ready.value);
      setLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [accessToken]);

  return <DashboardView entitlement={entitlement} sessions={sessions} readiness={readiness} loaded={loaded} />;
}

/**
 * The dashboard as pure markup over data it is handed.
 *
 * Split out from the fetching so it can be rendered from a test or a preview with whatever
 * history you want to look at. A page that can only be seen by signing in, finishing a
 * round and waiting for a report is a page whose layout never actually gets checked — and
 * this one had gone a long way wrong without anybody being able to see it.
 */
export function DashboardView({
  entitlement,
  sessions,
  readiness,
  loaded,
}: {
  entitlement: EntitlementView | null;
  sessions: SessionSummary[];
  readiness: ReadinessGroup[];
  loaded: boolean;
}) {
  const openSession = sessions.find((s) => s.status === "in_progress");

  return (
    <div className="flex flex-col gap-14">
      <section aria-labelledby="next-interview" className="flex flex-col gap-5">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {sessions.length === 0
            ? "Nothing practised yet"
            : `${sessions.length} ${sessions.length === 1 ? "round" : "rounds"} behind you`}
        </p>
        <h1 id="next-interview" className="max-w-2xl text-display text-balance text-ink">
          {sessions.length === 0 ? "Start your first interview" : "Start your next interview"}
        </h1>
        <p className="max-w-prose text-body text-ink-muted">
          You name the company and the role when you begin. Nothing to set up in advance, and no
          limit on how many employers you practise for.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          {openSession ? (
            <Link
              href={`/interview/${openSession.id}`}
              className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
            >
              Resume interview
            </Link>
          ) : (
            <Link
              href="/interview/new"
              aria-disabled={entitlement?.allowed === false}
              className={
                entitlement?.allowed === false
                  ? "pointer-events-none rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast opacity-50"
                  : "rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
              }
            >
              Start an interview
            </Link>
          )}

          {loaded && entitlement ? (
            <p className="text-caption text-ink-subtle">
              {/*
                * `remainingFree` is null while there is no limit, which is the case
                * today. Reading that as "none left" would have put a paywall notice on
                * a product that has no paywall.
                */}
              {entitlement.allowed
                ? entitlement.remainingFree === null
                  ? "Every round is free while we are building this. Report included, no card."
                  : entitlement.remainingFree > 0
                    ? "Your first interview is free, report included."
                    : null
                : entitlement.message}
            </p>
          ) : null}
        </div>
      </section>

      {sessions.length > 0 || readiness.length > 0 ? (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-16">
          {sessions.length > 0 ? (
            <section aria-labelledby="history" className="flex flex-col gap-4">
              <SectionHead title="Past interviews" id="history" note={`${sessions.length} total`} />
              <ul className="flex flex-col divide-y divide-line border-t border-line">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 py-3.5"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-body text-ink">
                        {session.companyName} · {session.roleTitle}
                      </span>
                      <span className="text-caption text-ink-subtle">
                        {statusLabel(session.status)}
                        {session.endedAt ? ` · ${formatDate(session.endedAt)}` : ""}
                      </span>
                    </div>
                    {session.status === "completed" ? (
                      <Link
                        href={`/report/${session.id}`}
                        className="shrink-0 text-caption text-accent underline-offset-4 hover:underline"
                      >
                        Read report
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {readiness.length > 0 ? (
            <section aria-labelledby="readiness" className="flex flex-col gap-4">
              <SectionHead title="Where you stand" id="readiness" note="From finished rounds" />
              <ul className="flex flex-col gap-3">
                {readiness.map((group) => (
                  <li
                    key={`${group.companyName}-${group.roleTitle}`}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-body text-ink">
                        {group.companyName}
                        <span className="block text-caption text-ink-subtle">{group.roleTitle}</span>
                      </span>
                      {group.latestAverageScore !== null ? (
                        <span className="flex shrink-0 items-baseline font-mono text-display leading-none tabular-nums text-ink">
                          {group.latestAverageScore}
                          <span className="pl-0.5 text-caption text-ink-subtle">%</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-2">
                      <span className="text-caption text-ink-subtle">
                        {group.sessionsCompleted}{" "}
                        {group.sessionsCompleted === 1 ? "attempt" : "attempts"}
                      </span>
                      {group.latestAverageScore !== null ? (
                        <Trend first={group.firstAverageScore} latest={group.latestAverageScore} />
                      ) : null}
                    </div>
                    {group.recurringWeaknesses.length > 0 ? (
                      <p className="text-caption text-ink-muted">
                        <span className="text-ink-subtle">Recurring: </span>
                        {group.recurringWeaknesses.join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * `08/09/2026` is the 8th of September to half this product's audience and the 9th of
 * August to the other half, and both halves are people we are explicitly building for.
 * Spelling the month out costs three characters and removes the question.
 *
 * Also fixed rather than locale-dependent, so the same string is produced wherever it is
 * rendered — `toLocaleDateString` on a server and in a browser do not have to agree, and
 * when they disagree React throws the page away and re-renders it.
 */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A heading and its aside on one baseline, over a rule. Used for every list on the page. */
function SectionHead({ title, id, note }: { title: string; id: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-heading text-ink">
        {title}
      </h2>
      {note ? <span className="text-caption text-ink-subtle">{note}</span> : null}
    </div>
  );
}

function Trend({ first, latest }: { first: number | null; latest: number }) {
  if (first === null || Math.abs(latest - first) < 1) return null;
  const up = latest > first;
  return (
    <span className={`text-caption ${up ? "text-positive" : "text-ink-subtle"}`}>
      {up ? "↑" : "↓"} {Math.abs(Math.round(latest - first))} since your first
    </span>
  );
}

function statusLabel(status: SessionSummary["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "abandoned":
      return "Left early";
    case "failed":
      return "Did not finish";
    default:
      return "Not started";
  }
}
