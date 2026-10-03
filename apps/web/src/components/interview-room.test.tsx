import type { SessionView } from "@acemyinterview/shared";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewRoom } from "./interview-room";
import { ApiRequestError } from "@/lib/api";

const fetchSession = vi.hoisted(() => vi.fn());
const beginSession = vi.hoisted(() => vi.fn());
const captureStart = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ token: "token-abc" }));
const questionAudio = vi.hoisted(() => ({ current: { url: null as string | null, status: "unavailable" } }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  fetchSession,
  beginSession,
  abandonSession: vi.fn(),
  finishSession: vi.fn(),
  requestHint: vi.fn(),
  reportInterviewClientEvent: vi.fn().mockResolvedValue(undefined),
  saveBoard: vi.fn(),
  submitAnswer: vi.fn(),
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => auth.token }));
vi.mock("@/components/device-check", () => ({
  DeviceCheck: ({
    onEnter,
    entering,
    entryError,
  }: {
    onEnter: () => void;
    entering?: boolean;
    entryError?: string | null;
  }) => (
    <div>
      <p>Device check</p>
      <button type="button" onClick={onEnter} disabled={entering}>
        Enter the room
      </button>
      {entryError ? <p role="alert">{entryError}</p> : null}
    </div>
  ),
}));
vi.mock("@/components/design-workspace", () => ({ DesignWorkspace: () => null }));
vi.mock("@/components/dsa-workspace", () => ({ DsaWorkspace: () => null }));
vi.mock("@/components/round-clock", () => ({
  RoundClock: () => null,
  formatDuration: () => "00:00",
}));
vi.mock("@/components/interviewer-presence", () => ({ InterviewerPresence: () => null }));
vi.mock("@/lib/use-interview-capture", () => ({
  useInterviewCapture: () => ({
    state: "ready",
    error: null,
    level: 0,
    stream: null,
    requestDevices: vi.fn(),
    start: captureStart,
    stop: vi.fn(),
    release: vi.fn(),
    isRecording: false,
  }),
}));
vi.mock("@/lib/use-browser-voice", () => ({
  useBrowserVoice: () => ({
    available: false,
    settled: true,
    spokenChars: 0,
    speaking: false,
    saying: null,
    said: null,
    say: vi.fn(),
    cancel: vi.fn(),
  }),
}));
vi.mock("@/lib/use-live-transcript", () => ({
  useLiveTranscript: () => ({ supported: false, text: "", start: vi.fn(), stop: vi.fn() }),
}));
vi.mock("@/lib/use-question-audio", () => ({
  useQuestionAudio: () => questionAudio.current,
}));

const baseSession = {
  id: "0f2b8a1c-1d3e-4a5b-8c7d-9e0f1a2b3c4d",
  companyName: "Infosys",
  roleTitle: "Senior Backend Engineer",
  roundLabel: "Project deep-dive",
  language: "english",
  status: "in_progress",
  consentVideo: false,
  startedAt: null,
  scheduledEndAt: null,
  currentTurn: {
    turnIndex: 0,
    questionText: "Tell me about the project.",
    questionAudioStatus: "unavailable",
  },
  workspace: null,
} as unknown as SessionView;

describe("InterviewRoom session entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.token = "token-abc";
    questionAudio.current = { url: null, status: "unavailable" };
  });

  it.each([
    ["completed", "That’s the end of the round."],
    ["abandoned", "This round was forfeited."],
    ["failed", "This round could not continue."],
    ["created", "This round is still being prepared."],
  ] as const)("keeps a %s session out of device check", async (status, heading) => {
    fetchSession.mockResolvedValue({ ...baseSession, status });

    render(<InterviewRoom sessionId={baseSession.id} />);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByText("Device check")).not.toBeInTheDocument();
    expect(beginSession).not.toHaveBeenCalled();
  });

  it("shows the server's begin failure and remains in device check", async () => {
    fetchSession.mockResolvedValue(baseSession);
    beginSession.mockRejectedValue(
      new ApiRequestError(409, "session_state_changed", "This interview has already ended."),
    );
    render(<InterviewRoom sessionId={baseSession.id} />);

    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This interview has already ended.");
    expect(screen.getByText("Device check")).toBeInTheDocument();
    expect(beginSession).toHaveBeenCalledTimes(1);
  });

  it("does not announce a writing-mode fallback when question audio is unavailable", async () => {
    fetchSession.mockResolvedValue(baseSession);
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:30:00Z",
    });
    render(<InterviewRoom sessionId={baseSession.id} />);

    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));

    expect(await screen.findByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();
    expect(screen.queryByText(/voice is unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/round is in writing/i)).not.toBeInTheDocument();
  });
});

/*
 * The mid-round stall (3 Oct 2026). A long round outlives the hourly access token, and the
 * room used to reload itself into the device check when the new token arrived.
 */
describe("InterviewRoom across an access-token rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.token = "token-abc";
    questionAudio.current = { url: null, status: "unavailable" };
  });

  it("stays in the room, without re-reading the session, when the token rotates", async () => {
    fetchSession.mockResolvedValue(baseSession);
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:45:00Z",
    });
    const { rerender } = render(<InterviewRoom sessionId={baseSession.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Enter the room" }));
    expect(await screen.findByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();

    auth.token = "token-rotated";
    rerender(<InterviewRoom sessionId={baseSession.id} />);
    // Give a re-read every chance to land before checking it did not.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Device check")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();
    expect(fetchSession).toHaveBeenCalledTimes(1);
  });
});

describe("InterviewRoom when the interviewer's recorded voice is slow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.token = "token-abc";
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the microphone once the grace period is spent, not when the poll gives up", async () => {
    questionAudio.current = { url: null, status: "pending" };
    fetchSession.mockResolvedValue({
      ...baseSession,
      currentTurn: { ...baseSession.currentTurn, questionAudioStatus: "pending" },
    });
    beginSession.mockResolvedValue({
      startedAt: "2026-09-29T09:00:00Z",
      scheduledEndAt: "2026-09-29T09:45:00Z",
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InterviewRoom sessionId={baseSession.id} />);
    await user.click(await screen.findByRole("button", { name: "Enter the room" }));
    expect(await screen.findByRole("button", { name: "Leave (forfeit)" })).toBeInTheDocument();

    // Inside the grace period the room is still waiting for the voice.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(captureStart).not.toHaveBeenCalled();

    // The grace period (25s) runs out: the question goes up in writing, and the candidate
    // gets the usual time to read it (4s) before the floor passes to them — well before
    // the 45-second poll ceiling the room used to wait for.
    await act(async () => {
      vi.advanceTimersByTime(6_000);
    });
    expect(captureStart).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(captureStart).toHaveBeenCalledTimes(1);
  });
});
