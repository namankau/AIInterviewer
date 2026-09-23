import type { SessionView } from "@acemyinterview/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewRoom } from "./interview-room";
import { ApiRequestError } from "@/lib/api";

const fetchSession = vi.hoisted(() => vi.fn());
const beginSession = vi.hoisted(() => vi.fn());

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
  saveBoard: vi.fn(),
  submitAnswer: vi.fn(),
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token-abc" }));
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
    start: vi.fn(),
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
  useQuestionAudio: () => ({ url: null, status: "unavailable" }),
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
});
