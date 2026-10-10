"use client";

import type { EntitlementView, ReadinessGroup, SessionSummary } from "@acemyinterview/shared";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DailyLimitNotice, isDailyLimitReached } from "@/components/daily-limit-notice";
import { deleteSession, fetchEntitlement, fetchReadiness, fetchSessions } from "@/lib/api";
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
  const { visible, handleDelete } = useRoundData();

  return (
    <DashboardView
      entitlement={visible.entitlement}
      sessions={visible.sessions}
      readiness={visible.readiness}
      loaded={visible.loaded}
      onDelete={handleDelete}
    />
  );
}

/**
 * Every round, on its own page. The dashboard shows only the latest few so starting the
 * next interview stays the first thing on it; this is where the rest live, with the same
 * report links and the same delete.
 */
export function RoundHistoryPanel() {
  const { visible, handleDelete } = useRoundData();

  if (!visible.loaded) {
    return <p className="text-body text-ink-muted">Loading your rounds…</p>;
  }
  if (visible.sessions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <p className="text-body text-ink-muted">No rounds yet. Your finished interviews will be listed here.</p>
        <Link
          href="/interview/new"
          className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Start an interview
        </Link>
      </div>
    );
  }
  return <PastRoundsSection sessions={visible.sessions} onDelete={handleDelete} />;
}

/** Sessions, entitlement and readiness for the signed-in account, plus round deletion. */
function useRoundData() {
  const accessToken = useAccessToken();
  const [dashboard, setDashboard] = useState<DashboardState>(() => emptyDashboard(null));

  // Identity changes are visible during render, before effects run. Never render data
  // whose owner is the token from a previous render, even for a single frame.
  const visible =
    typeof accessToken === "string" && dashboard.ownerToken === accessToken
      ? dashboard
      : emptyDashboard(accessToken ?? null);

  // No reset here: `visible` already hides anything another token fetched, so clearing
  // state on a token change would only add a render.
  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    Promise.allSettled([
      fetchEntitlement({ accessToken }),
      fetchSessions({ accessToken }),
      fetchReadiness({ accessToken }),
    ]).then(([ent, list, ready]) => {
      if (!active) return;
      setDashboard({
        ownerToken: accessToken,
        entitlement: ent.status === "fulfilled" ? ent.value : null,
        sessions: list.status === "fulfilled" ? list.value : [],
        readiness: ready.status === "fulfilled" ? ready.value : [],
        loaded: true,
      });
    });

    return () => {
      active = false;
    };
  }, [accessToken]);

  /**
   * Deleting a round is irreversible on the server, so it is reflected here rather than
   * refetched: the row goes the moment the request succeeds, and a failure is raised to
   * the row that asked for it. Readiness *is* refetched, because it is derived from the
   * reports that just stopped existing — the grouping and the averages are the server's
   * arithmetic and recomputing them here would be a second implementation of it.
   */
  const handleDelete = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      const operationToken = accessToken;
      await deleteSession(operationToken, id);
      setDashboard((current) =>
        current.ownerToken === operationToken
          ? { ...current, sessions: current.sessions.filter((session) => session.id !== id) }
          : current,
      );
      try {
        const nextReadiness = await fetchReadiness({ accessToken: operationToken });
        setDashboard((current) =>
          current.ownerToken === operationToken
            ? { ...current, readiness: nextReadiness }
            : current,
        );
      } catch {
        // The deletion itself succeeded. Leaving the previous readiness on screen makes
        // it briefly stale, which is a far smaller lie than reporting a failed delete.
      }
    },
    [accessToken],
  );

  return { visible, handleDelete };
}

interface DashboardState {
  ownerToken: string | null;
  entitlement: EntitlementView | null;
  sessions: SessionSummary[];
  readiness: ReadinessGroup[];
  loaded: boolean;
}

function emptyDashboard(ownerToken: string | null): DashboardState {
  return { ownerToken, entitlement: null, sessions: [], readiness: [], loaded: false };
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
  onDelete,
}: {
  entitlement: EntitlementView | null;
  sessions: SessionSummary[];
  readiness: ReadinessGroup[];
  loaded: boolean;
  onDelete?: (id: string) => Promise<void>;
}) {
  const openSession = sessions.find((s) => s.status === "in_progress");
  const primaryHref = (openSession ? `/interview/${openSession.id}` : "/interview/new") as Route;
  const primaryLabel = openSession ? "Resume interview" : "Start an interview";
  const disabled = !openSession && entitlement?.allowed === false;

  return (
    <div className="flex flex-col gap-9 md:gap-11">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-accent">Your practice workspace</p>
          <h1 id="next-interview" className="mt-2 max-w-3xl text-display text-balance text-ink">
            {sessions.length === 0 ? "Start building interview momentum." : "Keep your momentum going."}
          </h1>
          <p className="mt-2 max-w-2xl text-body text-ink-muted">
            One focused round today gets you closer to answering calmly when the real follow-up lands.
          </p>
        </div>
        <Link
          href={primaryHref}
          aria-disabled={disabled}
          className={`action-primary min-h-12 shrink-0 px-6 text-body ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          {primaryLabel} <span aria-hidden>→</span>
        </Link>
      </header>

      <section aria-labelledby="practice-allowance" className="hero-band overflow-hidden px-6 py-7 sm:px-9 sm:py-8">
        <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14">
          <div>
            <p className="eyebrow text-accent-on-navy">Today&apos;s practice</p>
            <h2 id="practice-allowance" className="mt-3 text-title text-on-navy">
              {entitlement?.dailyRoundLimit !== null && entitlement?.dailyRoundLimit !== undefined
                ? `${entitlement.dailyRoundLimit} focused rounds, at your pace.`
                : "Practise the round you need, when you need it."}
            </h2>
            <p className="mt-2 max-w-xl text-caption text-on-navy-muted">
              {loaded && entitlement
                ? entitlement.allowed
                  ? entitlement.dailyRoundLimit !== null || entitlement.dailyMinuteLimit !== null
                    ? `${entitlement.message} The full report is included.`
                    : entitlement.remainingFree === null
                      ? "Every round is free while we are building this. The full report is included."
                      : "Your report is included with the round."
                  : entitlement.message
                : "Your practice availability will appear here."}
            </p>
          </div>

          <AllowanceMeters entitlement={entitlement} loaded={loaded} />
        </div>
      </section>

      {loaded && entitlement && isDailyLimitReached(entitlement) ? (
        <DailyLimitNotice entitlement={entitlement} />
      ) : null}

      {sessions.length > 0 || readiness.length > 0 ? (
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {sessions.length > 0 ? (
            <PastRoundsSection sessions={sessions} onDelete={onDelete} limit={DASHBOARD_ROUNDS} />
          ) : null}

          {readiness.length > 0 ? (
            <section aria-labelledby="readiness" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
              <SectionHead title="Where you stand" id="readiness" note="Readiness by goal" />
              <ul className="flex flex-col gap-3">
                {readiness.slice(0, DASHBOARD_READINESS_GROUPS).map((group) => (
                  <li
                    key={`${group.companyName}-${group.roleTitle}`}
                    className="flex flex-col gap-3 rounded-xl bg-surface-sunken/75 px-4 py-4"
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
              {readiness.length > DASHBOARD_READINESS_GROUPS ? (
                <Link
                  href="/history"
                  className="self-start rounded-sm text-caption font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  See all reports
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AllowanceMeters({ entitlement, loaded }: { entitlement: EntitlementView | null; loaded: boolean }) {
  if (!loaded || !entitlement) {
    return <p role="status" className="text-caption text-on-navy-muted">Loading today&apos;s allowance…</p>;
  }

  const meters = [
    entitlement.dailyRoundLimit === null
      ? null
      : {
          label: "Interviews",
          used: Math.max(0, entitlement.dailyRoundLimit - (entitlement.remainingRoundsToday ?? 0)),
          limit: entitlement.dailyRoundLimit,
        },
    entitlement.dailyMinuteLimit === null
      ? null
      : {
          label: "Practice time",
          used: Math.max(0, entitlement.dailyMinuteLimit - (entitlement.remainingMinutesToday ?? 0)),
          limit: entitlement.dailyMinuteLimit,
        },
  ].filter((meter): meter is { label: string; used: number; limit: number } => meter !== null);

  if (meters.length === 0) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/8 px-5 py-4">
        <p className="eyebrow text-accent-on-navy">Open access</p>
        <p className="mt-2 text-caption text-on-navy">No daily round or minute limit is active.</p>
      </div>
    );
  }

  return (
    <dl className="grid gap-4">
      {meters.map((meter) => {
        const percent = meter.limit === 0 ? 0 : Math.min(100, (meter.used / meter.limit) * 100);
        const unit = meter.label === "Practice time" ? " min" : "";
        return (
          <div key={meter.label}>
            <div className="flex items-center justify-between gap-4 text-caption">
              <dt className="text-on-navy-muted">{meter.label}</dt>
              <dd className="font-semibold text-on-navy">{meter.used} of {meter.limit}{unit} used</dd>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
              <span className="block h-full rounded-full bg-[#a8e7d7]" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </dl>
  );
}

/** How many rounds the dashboard lists before pointing at the full history. */
const DASHBOARD_ROUNDS = 3;

/** Keep the readiness column as a summary; the complete report list lives in history. */
const DASHBOARD_READINESS_GROUPS = 3;

/**
 * The past-rounds list. With a `limit`, only the newest rounds are shown (the API returns
 * newest first) and the rest are a link away, so a long history never pushes the
 * readiness panel and the next interview out of view.
 */
export function PastRoundsSection({
  sessions,
  onDelete,
  limit,
}: {
  sessions: SessionSummary[];
  onDelete?: (id: string) => Promise<void>;
  limit?: number;
}) {
  const shown = limit === undefined ? sessions : sessions.slice(0, limit);
  const hidden = sessions.length - shown.length;
  // Every row carries the same window; the server is the authority on the number and
  // this page only repeats it. Nothing is claimed if the API has not said.
  const retentionDays = sessions.find((s) => s.reportRetentionDays > 0)?.reportRetentionDays ?? null;

  return (
    <section aria-labelledby="history" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <SectionHead
        title={limit === undefined ? "All interviews" : "Recent interviews"}
        id="history"
        note={`${sessions.length} total`}
      />
      {/*
        * The rule, stated before it bites rather than explained afterwards. A
        * candidate who comes back in five weeks for the report they were promised
        * and finds it gone has been surprised by us, and being surprised by a
        * product holding your career anxiety is the thing to avoid.
        */}
      {retentionDays ? (
        <p className="max-w-prose text-caption text-ink-subtle">
          Reports are kept for {retentionDays} days after the round. After that the report,
          the transcript and the recording are deleted, and the round stays here as a line
          without one. You can delete any round yourself before then.
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((session) => (
          <PastRound key={session.id} session={session} onDelete={onDelete} />
        ))}
      </ul>
      {hidden > 0 ? (
        <Link
          href="/history"
          className="self-start rounded-sm text-caption font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          See all {sessions.length} rounds
        </Link>
      ) : null}
    </section>
  );
}

/**
 * One round in the history list, with the two things that can be done to it: read the
 * report, and destroy it.
 *
 * The delete is guarded by a second click on the same button rather than by
 * `window.confirm`. A native dialog is untestable, unstyleable, and — the part that
 * actually matters — it looks like the browser asking rather than like this product
 * asking, at the one moment a candidate needs to be certain about what they are agreeing
 * to. The confirmation says what goes, in the words the retention notice above uses, so
 * the two cannot describe the same operation differently.
 *
 * Keeping the *same* button element across both states is deliberate: replacing it would
 * drop keyboard focus onto the body, stranding anybody who got here by tabbing. The
 * explanation is announced politely instead, and Cancel is one tab away.
 */
function PastRound({
  session,
  onDelete,
}: {
  session: SessionSummary;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const round = `${session.companyName}, ${session.roleTitle}`;
  const soon = expiringSoon(session);

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-body text-ink">
          {session.companyName} · {session.roleTitle}
        </span>
        <span className="text-caption text-ink-subtle">
          {statusLabel(session.status)}
          {session.endedAt ? ` · ${formatDate(session.endedAt)}` : ""}
          {soon ? ` · report until ${formatDate(soon)}` : ""}
        </span>
        <span aria-live="polite" className="empty:hidden">
          {confirming ? (
            <span className="text-caption text-ink-muted">
              Delete this round for good? The report, the transcript and the recording go with
              it.
            </span>
          ) : null}
          {error ? <span className="text-caption text-danger">{error}</span> : null}
        </span>
      </div>

      <div className="flex shrink-0 items-baseline gap-4">
        {/*
          * No link once retention has cleared the round. Following it would reach a page
          * that can only apologise, which is exactly the dead end `reportExpired` exists
          * to stop — so the state is said here instead.
          */}
        {session.status === "completed" && !session.reportExpired ? (
          <Link
            href={`/report/${session.id}`}
            className="text-caption text-accent underline-offset-4 hover:underline"
          >
            Read report
          </Link>
        ) : null}
        {session.status === "completed" && session.reportExpired ? (
          <span className="text-caption text-ink-subtle">Report expired</span>
        ) : null}

        {onDelete ? (
          <>
            {confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              aria-label={
                confirming
                  ? `Confirm deleting the ${round} round permanently`
                  : `Delete the ${round} round`
              }
              onClick={async () => {
                if (!confirming) {
                  setError(null);
                  setConfirming(true);
                  return;
                }
                setBusy(true);
                try {
                  await onDelete(session.id);
                } catch {
                  // The row is still on screen and still theirs. Say so and let them try
                  // again rather than removing it optimistically and being wrong.
                  setBusy(false);
                  setConfirming(false);
                  setError("That round could not be deleted. Try again in a moment.");
                }
              }}
              className={
                confirming
                  ? "text-caption text-danger underline-offset-4 hover:underline disabled:opacity-50"
                  : "text-caption text-ink-subtle underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
              }
            >
              {confirming ? "Delete for good" : "Delete"}
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The expiry date, but only once it is close enough to act on.
 *
 * Four weeks out it is noise on every row; a week out it is the difference between saving
 * a report and losing one. The rule itself is stated once above the list, so this is a
 * reminder rather than the only warning.
 */
function expiringSoon(session: SessionSummary): string | null {
  if (session.reportExpired || !session.reportExpiresAt) return null;
  const at = new Date(session.reportExpiresAt).getTime();
  if (Number.isNaN(at)) return null;
  const daysLeft = (at - Date.now()) / 86_400_000;
  return daysLeft <= EXPIRY_NOTICE_DAYS ? session.reportExpiresAt : null;
}

/** How long before expiry a round starts saying so. One week is enough to act on. */
const EXPIRY_NOTICE_DAYS = 7;

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
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
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
