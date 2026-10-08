import type { ReadinessGroup, SessionSummary } from "@acemyinterview/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DashboardView, PastRoundsSection } from "./dashboard-panel";

const DAY = 86_400_000;

const round = (over: Partial<SessionSummary> = {}): SessionSummary => ({
  id: "s1",
  companyName: "Infosys",
  roleTitle: "Systems Engineer",
  roundType: "techno_managerial",
  status: "completed",
  startedAt: "2026-09-01T10:00:00Z",
  endedAt: "2026-09-01T10:40:00Z",
  hasReport: true,
  reportExpired: false,
  reportExpiresAt: new Date(Date.now() + 20 * DAY).toISOString(),
  reportRetentionDays: 28,
  ...over,
});

const view = (sessions: SessionSummary[], onDelete?: (id: string) => Promise<void>) =>
  render(
    <DashboardView
      entitlement={null}
      sessions={sessions}
      readiness={[]}
      loaded
      onDelete={onDelete}
    />,
  );

/**
 * These cover the two ways this page can mislead somebody about their own data: deleting a
 * round they did not mean to delete, and offering them a report that no longer exists.
 */
describe("DashboardView deletion and retention", () => {
  it("states the retention rule where the reports are listed", () => {
    view([round()]);

    expect(screen.getByText(/kept for 28 days after the round/i)).toBeInTheDocument();
  });

  /**
   * The rule is server policy — one property in `application.yml` — so the page repeats
   * whatever the API says rather than a number written into the browser.
   */
  it("repeats the window the server sent rather than a hardcoded one", () => {
    view([round({ reportRetentionDays: 90 })]);

    expect(screen.getByText(/kept for 90 days after the round/i)).toBeInTheDocument();
    expect(screen.queryByText(/28 days/i)).not.toBeInTheDocument();
  });

  it("does not delete on the first click", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    view([round()], onDelete);

    await userEvent.click(screen.getByRole("button", { name: /^delete the Infosys/i }));

    expect(onDelete).not.toHaveBeenCalled();
    // And it says what will go, before it goes.
    expect(
      screen.getByText(/the report, the transcript and the recording go with it/i),
    ).toBeInTheDocument();
  });

  it("deletes on the second click", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    view([round()], onDelete);

    await userEvent.click(screen.getByRole("button", { name: /^delete the Infosys/i }));
    await userEvent.click(screen.getByRole("button", { name: /^confirm deleting the Infosys/i }));

    expect(onDelete).toHaveBeenCalledWith("s1");
  });

  it("can be called off before it happens", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    view([round()], onDelete);

    await userEvent.click(screen.getByRole("button", { name: /^delete the Infosys/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^confirm deleting/i })).not.toBeInTheDocument();
    // Back to a single, unarmed control rather than a row that stays primed to delete.
    expect(screen.getByRole("button", { name: /^delete the Infosys/i })).toBeInTheDocument();
  });

  /**
   * A failed delete must leave the round on screen and say so. Removing the row and
   * hoping would tell the candidate their interview was destroyed when it was not.
   */
  it("says so when the deletion fails, and keeps the round", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("network"));
    view([round()], onDelete);

    await userEvent.click(screen.getByRole("button", { name: /^delete the Infosys/i }));
    await userEvent.click(screen.getByRole("button", { name: /^confirm deleting the Infosys/i }));

    expect(await screen.findByText(/could not be deleted/i)).toBeInTheDocument();
    expect(screen.getByText(/Infosys · Systems Engineer/)).toBeInTheDocument();
  });

  /**
   * The dead end this whole feature exists to prevent: a completed round whose report
   * retention has already cleared, still offering a link into a page that can only
   * apologise.
   */
  it("offers no report link once retention has cleared the round", () => {
    view([round({ reportExpired: true, reportExpiresAt: null })]);

    expect(screen.queryByRole("link", { name: /read report/i })).not.toBeInTheDocument();
    expect(screen.getByText(/report expired/i)).toBeInTheDocument();
  });

  it("still links to a report that is within its window", () => {
    view([round()]);

    expect(screen.getByRole("link", { name: /read report/i })).toHaveAttribute(
      "href",
      "/report/s1",
    );
  });

  /**
   * A date on every row four weeks out is noise; a date on the row about to lose its
   * report is the warning that makes the rule actionable.
   */
  it("names the expiry date only once it is close", () => {
    const { unmount } = view([round({ reportExpiresAt: new Date(Date.now() + 3 * DAY).toISOString() })]);
    expect(screen.getByText(/report until/i)).toBeInTheDocument();
    unmount();

    view([round({ reportExpiresAt: new Date(Date.now() + 20 * DAY).toISOString() })]);
    expect(screen.queryByText(/report until/i)).not.toBeInTheDocument();
  });

  /** Each row's control acts on its own round, not on whichever one was rendered first. */
  it("deletes the round whose button was pressed", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    view(
      [round(), round({ id: "s2", companyName: "Google", roleTitle: "Backend Engineer" })],
      onDelete,
    );

    const googleRow = screen.getByText(/Google · Backend Engineer/).closest("li");
    expect(googleRow).not.toBeNull();
    await userEvent.click(
      within(googleRow as HTMLElement).getByRole("button", { name: /^delete the Google/i }),
    );
    await userEvent.click(
      within(googleRow as HTMLElement).getByRole("button", { name: /^confirm deleting the Google/i }),
    );

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("s2");
  });
});

describe("DashboardView history length", () => {
  const many = ["a", "b", "c", "d", "e"].map((id, index) =>
    round({ id, companyName: `Company ${index + 1}` }),
  );

  it("lists only the three newest rounds, and links to the rest", () => {
    view(many);

    const list = within(screen.getByRole("region", { name: /recent interviews/i }));
    expect(list.getAllByRole("listitem")).toHaveLength(3);
    expect(list.getByText(/Company 1/)).toBeInTheDocument();
    expect(list.queryByText(/Company 4/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all 5 rounds" })).toHaveAttribute("href", "/history");
  });

  it("has nothing to link to when every round already fits", () => {
    view(many.slice(0, 3));

    expect(screen.queryByRole("link", { name: /see all/i })).not.toBeInTheDocument();
  });

  it("shows every round on the full history", () => {
    render(<PastRoundsSection sessions={many} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "All interviews" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /see all/i })).not.toBeInTheDocument();
  });
});

describe("DashboardView readiness length", () => {
  const readiness = ["Infosys", "Adyen", "Deloitte", "Microsoft", "Google"].map(
    (companyName, index): ReadinessGroup => ({
      companyName,
      roleTitle: `Role ${index + 1}`,
      sessionsCompleted: 1,
      firstAttemptAt: "2026-09-01T10:00:00Z",
      latestAttemptAt: "2026-09-01T10:00:00Z",
      firstAverageScore: 40,
      latestAverageScore: 40,
      recurringWeaknesses: [],
    }),
  );

  it("shows three readiness summaries and points to the full report history", () => {
    render(
      <DashboardView
        entitlement={null}
        sessions={[]}
        readiness={readiness}
        loaded
      />,
    );

    const section = screen.getByRole("region", { name: /where you stand/i });
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).getByText("Infosys")).toBeInTheDocument();
    expect(within(section).queryByText("Microsoft")).not.toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "See all reports" })).toHaveAttribute(
      "href",
      "/history",
    );
  });

  it("does not show the all-reports link when all readiness summaries fit", () => {
    render(
      <DashboardView
        entitlement={null}
        sessions={[]}
        readiness={readiness.slice(0, 3)}
        loaded
      />,
    );

    expect(screen.queryByRole("link", { name: "See all reports" })).not.toBeInTheDocument();
  });
});

describe("DashboardView daily allowance", () => {
  const base = {
    remainingFree: null,
    dailyRoundLimit: 2,
    dailyMinuteLimit: 60,
  };

  it("says what is left today while practice remains", () => {
    render(
      <DashboardView
        entitlement={{
          ...base,
          allowed: true,
          reason: "allowed",
          message: "Free practice today: 1 round and 20 minutes left.",
          remainingRoundsToday: 1,
          remainingMinutesToday: 20,
        }}
        sessions={[]}
        readiness={[]}
        loaded
      />,
    );

    expect(screen.getByText(/1 round and 20 minutes left/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start an interview/i })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("replaces the start with the upgrade notice once the day is used", () => {
    render(
      <DashboardView
        entitlement={{
          ...base,
          allowed: false,
          reason: "daily_minutes_reached",
          message: "You have used today's free practice (2 rounds or 60 minutes a day).",
          remainingRoundsToday: 1,
          remainingMinutesToday: 0,
        }}
        sessions={[]}
        readiness={[]}
        loaded
      />,
    );

    expect(screen.getByRole("heading", { name: /today.s free practice is used/i })).toBeInTheDocument();
    expect(screen.getByText(/pro · coming soon/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start an interview/i })).toHaveAttribute("aria-disabled", "true");
  });
});
