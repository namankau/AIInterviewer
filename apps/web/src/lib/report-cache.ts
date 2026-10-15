import type { SessionReport } from "@untiered/shared";

/**
 * Reports this tab has already loaded, by session id.
 *
 * The interview's closing screen waits for the report to finish generating, so by the time
 * the candidate presses "Read the report" it is already in hand. Keeping it here lets the
 * report page render on the first frame instead of asking the API for it a second time.
 *
 * Memory only, never storage: a report is personal, and nothing of it should outlive the
 * tab or be readable by the next person at a shared computer.
 */
const reports = new Map<string, SessionReport>();

export function rememberReport(sessionId: string, report: SessionReport): void {
  reports.set(sessionId, report);
}

export function cachedReport(sessionId: string): SessionReport | null {
  return reports.get(sessionId) ?? null;
}

export function forgetReports(): void {
  reports.clear();
}
