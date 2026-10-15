import type { SessionReport } from "@untiered/shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError, fetchReport } from "@/lib/api";
import { forgetReports, rememberReport } from "@/lib/report-cache";

import { ReportView } from "./report-view";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "test-token" }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchReport: vi.fn(),
}));

const fetchReportMock = vi.mocked(fetchReport);
const completedReport = {
  sessionId: "session-1",
  companyName: "Example Company",
  roleTitle: "Engineer",
  roundType: "technical_fundamentals",
  roundLabel: "Technical round",
  archetypeLabel: "Product company",
  answeredTurns: 2,
  assessableTurns: 0,
  headline: "Your technical report is ready.",
  summary: "The round is complete.",
  competencies: [],
  annotations: [],
  strengths: [],
  developmentAreas: [],
  practicePlan: [],
} as unknown as SessionReport;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ReportView generation recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    forgetReports();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [new ApiRequestError(409, "report_generating", "still writing")],
    [new ApiRequestError(502, "bad_gateway", "upstream timed out")],
    [new ApiRequestError(504, "gateway_timeout", "upstream timed out")],
  ])("keeps the waiting room and retries a transient response after five seconds", async (fault) => {
    fetchReportMock.mockRejectedValue(fault);
    render(<ReportView sessionId="session-1" />);

    await advance(0);
    expect(screen.getByRole("status")).toHaveTextContent("Building your evidence-backed report");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchReportMock).toHaveBeenCalledTimes(1);

    await advance(4_999);
    expect(fetchReportMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchReportMock).toHaveBeenCalledTimes(2);

    await advance(9_999);
    expect(fetchReportMock).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetchReportMock).toHaveBeenCalledTimes(3);
    await advance(20_000);
    expect(fetchReportMock).toHaveBeenCalledTimes(4);
    await advance(29_999);
    expect(fetchReportMock).toHaveBeenCalledTimes(4);
    await advance(1);
    expect(fetchReportMock).toHaveBeenCalledTimes(5);
  });

  it("shows the finished report after a refresh during generation", async () => {
    fetchReportMock
      .mockRejectedValueOnce(new ApiRequestError(409, "report_generating", "still writing"))
      .mockResolvedValueOnce(completedReport);
    render(<ReportView sessionId="session-1" />);

    await advance(5_000);
    expect(screen.getByRole("heading", { name: "Your technical report is ready." })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a fresh attempt after ten minutes of generation responses", async () => {
    fetchReportMock.mockRejectedValue(new ApiRequestError(409, "report_generating", "still writing"));
    render(<ReportView sessionId="session-1" />);

    await advance(600_000);
    expect(screen.getByRole("heading", { name: /taking longer than expected/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await advance(0);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(fetchReportMock).toHaveBeenCalledTimes(24);
  });

  it("shows a non-generation error and does not retry it", async () => {
    fetchReportMock.mockRejectedValue(new ApiRequestError(403, "forbidden", "No access to this report"));
    render(<ReportView sessionId="session-1" />);

    await advance(0);
    expect(screen.getByRole("alert")).toHaveTextContent("No access to this report");
    await advance(60_000);
    expect(fetchReportMock).toHaveBeenCalledTimes(1);
  });

  it("cancels scheduled retries when the page unmounts", async () => {
    fetchReportMock.mockRejectedValue(new ApiRequestError(409, "report_generating", "still writing"));
    const view = render(<ReportView sessionId="session-1" />);
    await advance(0);

    view.unmount();
    await advance(60_000);
    expect(fetchReportMock).toHaveBeenCalledTimes(1);
  });

  it("opens a report the closing screen already loaded without asking again", async () => {
    rememberReport("session-1", completedReport);
    render(<ReportView sessionId="session-1" />);

    await advance(0);
    expect(screen.getByText("Your technical report is ready.")).toBeInTheDocument();
    expect(fetchReportMock).not.toHaveBeenCalled();
  });
});
