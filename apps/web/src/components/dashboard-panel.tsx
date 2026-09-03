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

  const openSession = sessions.find((s) => s.status === "in_progress");

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="next-interview" className="flex flex-col gap-5">
        <h1 id="next-interview" className="text-title text-ink">
          {sessions.length === 0 ? "Start your first interview" : "Start your next interview"}
        </h1>
        <p className="max-w-prose text-body text-ink-muted">
          You name the company and the role when you begin. Nothing to set up in advance, and no
          limit on how many employers you practise for.
        </p>

        <div className="flex flex-wrap items-center gap-4">
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

      {readiness.length > 0 ? (
        <section aria-labelledby="readiness" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 id="readiness" className="text-heading text-ink">
              Where you stand
            </h2>
            <p className="text-caption text-ink-subtle">
              Grouped from the interviews you have finished.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {readiness.map((group) => (
              <li
                key={`${group.companyName}-${group.roleTitle}`}
                className="flex flex-wrap items-baseline justify-between gap-3 py-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-body text-ink">
                    {group.companyName} · {group.roleTitle}
                  </span>
                  {group.recurringWeaknesses.length > 0 ? (
                    <span className="text-caption text-ink-subtle">
                      Recurring: {group.recurringWeaknesses.join(", ")}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-caption text-ink-subtle">
                    {group.sessionsCompleted} {group.sessionsCompleted === 1 ? "attempt" : "attempts"}
                  </span>
                  {group.latestAverageScore !== null ? (
                    <span className="font-mono text-caption text-ink-muted">
                      {group.latestAverageScore}%
                      <Trend first={group.firstAverageScore} latest={group.latestAverageScore} />
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sessions.length > 0 ? (
        <section aria-labelledby="history" className="flex flex-col gap-5">
          <h2 id="history" className="text-heading text-ink">
            Past interviews
          </h2>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body text-ink">
                    {session.companyName} · {session.roleTitle}
                  </span>
                  <span className="text-caption text-ink-subtle">
                    {statusLabel(session.status)}
                    {session.endedAt ? ` · ${new Date(session.endedAt).toLocaleDateString()}` : ""}
                  </span>
                </div>
                {session.status === "completed" ? (
                  <Link
                    href={`/report/${session.id}`}
                    className="text-caption text-accent underline-offset-4 hover:underline"
                  >
                    Read report
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Trend({ first, latest }: { first: number | null; latest: number }) {
  if (first === null || Math.abs(latest - first) < 1) return null;
  const up = latest > first;
  return (
    <span className={up ? "pl-1 text-accent" : "pl-1 text-ink-subtle"}>
      {up ? "↑" : "↓"} {Math.abs(Math.round(latest - first))}
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
