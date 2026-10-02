import type { SessionSummary } from "@acemyinterview/shared";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPanel } from "./dashboard-panel";

const auth = vi.hoisted(() => ({ token: "account-a" as string | null | undefined }));
const api = vi.hoisted(() => ({
  fetchEntitlement: vi.fn(),
  fetchSessions: vi.fn(),
  fetchReadiness: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => auth.token }));
vi.mock("@/lib/api", () => api);

const session = (id: string, companyName: string): SessionSummary => ({
  id,
  companyName,
  roleTitle: "Engineer",
  roundType: "technical_fundamentals",
  status: "completed",
  startedAt: "2026-09-01T10:00:00Z",
  endedAt: "2026-09-01T10:40:00Z",
  hasReport: true,
  reportExpired: false,
  reportExpiresAt: null,
  reportRetentionDays: 28,
});

describe("DashboardPanel account isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.token = "account-a";
    api.fetchEntitlement.mockResolvedValue({ allowed: true, remainingFree: null });
    api.fetchReadiness.mockResolvedValue([]);
  });

  it("hides the previous account's interviews as soon as the identity changes", async () => {
    api.fetchSessions.mockResolvedValueOnce([session("a", "Private A interview")]);
    const view = render(<DashboardPanel />);
    expect(await screen.findByText(/Private A interview/)).toBeInTheDocument();

    api.fetchSessions.mockRejectedValueOnce(new Error("account B request failed"));
    auth.token = "account-b";
    view.rerender(<DashboardPanel />);

    expect(screen.queryByText(/Private A interview/)).not.toBeInTheDocument();
    await waitFor(() => expect(api.fetchSessions).toHaveBeenCalledWith({ accessToken: "account-b" }));
    expect(screen.queryByText(/Private A interview/)).not.toBeInTheDocument();
  });

  it("ignores a slow response from the account that has signed out", async () => {
    let resolveA!: (sessions: SessionSummary[]) => void;
    api.fetchSessions.mockImplementationOnce(
      () => new Promise<SessionSummary[]>((resolve) => (resolveA = resolve)),
    );
    const view = render(<DashboardPanel />);

    auth.token = null;
    view.rerender(<DashboardPanel />);
    await act(async () => resolveA([session("a", "Late private interview")]));

    expect(screen.queryByText(/Late private interview/)).not.toBeInTheDocument();
  });
});
