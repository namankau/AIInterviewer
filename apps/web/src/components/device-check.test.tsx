import type { MeResponse, SessionView } from "@acemyinterview/shared";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeviceCheck } from "./device-check";
import type { useInterviewCapture } from "@/lib/use-interview-capture";

type Capture = ReturnType<typeof useInterviewCapture>;

const fetchMe = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ fetchMe, ApiRequestError: class extends Error {} }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession } }),
}));

const me = {
  id: "6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11",
  email: "candidate@example.com",
  displayName: "Naman Kaushik",
  preferredLanguage: "english",
  createdAt: "2026-08-25T10:00:00Z",
  profile: {},
} as unknown as MeResponse;

const session: SessionView = {
  id: "0f2b8a1c-1d3e-4a5b-8c7d-9e0f1a2b3c4d",
  companyName: "Infosys",
  archetype: "service_based_it",
  archetypeLabel: "Service-based IT",
  archetypeConfidence: "recognised",
  groundingNote: "Run as a service-based IT loop.",
  roleTitle: "Senior Backend Engineer",
  roundType: "project_deep_dive",
  roundLabel: "Project deep-dive",
  language: "english",
  status: "in_progress",
  consentVideo: false,
  startedAt: "2026-09-03T04:00:00Z",
  endedAt: null,
  durationMinutes: 40,
  scheduledEndAt: "2026-09-03T04:40:00Z",
  turnsCompleted: 0,
  maxTurns: 8,
  currentTurn: null,
};

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    state: "ready",
    error: null,
    // Comfortably above `SPEECH_LEVEL`, so the meter reads as somebody talking.
    level: 0.4,
    stream: null,
    requestDevices: vi.fn().mockResolvedValue(null),
    start: vi.fn().mockResolvedValue(true),
    stop: vi.fn().mockResolvedValue(null),
    release: vi.fn(),
    isRecording: false,
    ...overrides,
  } as Capture;
}

/** The row for one check, so an assertion cannot accidentally match a different one. */
function row(label: string): HTMLElement {
  const element = screen.getByText(label).closest("li");
  if (!element) throw new Error(`No check row labelled "${label}".`);
  return element;
}

/**
 * A browser that can speak.
 *
 * jsdom has no `speechSynthesis` at all, which is a real and common case — it is what a
 * browser with no usable voice looks like — so it is the default here and this is opted
 * into by the tests that need the voice to actually be said.
 */
function stubSynthesiser(voices: { name: string; lang: string }[]): string[] {
  const spoken: string[] = [];

  class Utterance {
    text: string;
    voice: unknown = null;
    lang = "";
    rate = 1;
    onboundary: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => voices,
    speak: (utterance: Utterance) => {
      spoken.push(utterance.text);
      utterance.onend?.();
    },
    cancel: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });

  return spoken;
}

describe("DeviceCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: "token-abc" } } });
    fetchMe.mockResolvedValue(me);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("asks for the devices on arrival, once", () => {
    const devices = capture();
    const { rerender } = render(
      <DeviceCheck session={session} capture={devices} onEnter={vi.fn()} />,
    );
    rerender(<DeviceCheck session={session} capture={devices} onEnter={vi.fn()} />);

    expect(devices.requestDevices).toHaveBeenCalledTimes(1);
  });

  it("greets the candidate by name once their profile arrives", async () => {
    render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Hi Naman." })).toBeInTheDocument();
  });

  /**
   * An email address is not a name. Greeting somebody as "naman.kaushik06" is worse than
   * not greeting them, so a profile without a display name simply does not produce one.
   */
  it("does not invent a greeting when there is no name to use", async () => {
    fetchMe.mockResolvedValue({ ...me, displayName: null });
    render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Before you go in." })).toBeInTheDocument();
    expect(screen.queryByText(/candidate@example\.com/)).not.toBeInTheDocument();
  });

  it("lets the candidate in once the microphone is live", async () => {
    const onEnter = vi.fn();
    render(<DeviceCheck session={session} capture={capture()} onEnter={onEnter} />);

    await userEvent.click(screen.getByRole("button", { name: /enter the room/i }));

    expect(onEnter).toHaveBeenCalled();
  });

  /**
   * The round is spoken, and it is half an hour of the candidate's time. Walking into
   * it with a blocked microphone would waste all of it, so entry is closed until the
   * device works.
   */
  it("will not let anyone in without a microphone", async () => {
    const onEnter = vi.fn();
    render(
      <DeviceCheck
        session={session}
        capture={capture({ state: "denied", error: "Microphone access was blocked." })}
        onEnter={onEnter}
      />,
    );

    const enter = screen.getByRole("button", { name: /enter the room/i });
    expect(enter).toBeDisabled();
    await userEvent.click(enter);
    expect(onEnter).not.toHaveBeenCalled();

    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access was blocked.");
    expect(screen.getByText(/allow the microphone for this site/i)).toBeInTheDocument();
  });

  it("says the browser is still asking rather than claiming it is ready", () => {
    render(
      <DeviceCheck session={session} capture={capture({ state: "requesting" })} onEnter={vi.fn()} />,
    );

    expect(screen.getByText(/waiting on the browser's permission prompt/i)).toBeInTheDocument();
  });

  describe("the staged progression", () => {
    /**
     * The sequence is the point. A row that ticked green before the check above it had
     * finished would be a progress bar that was always going to fill, which is exactly
     * what a pre-flight must not be.
     */
    it("starts nothing downstream while the microphone is still being asked for", async () => {
      render(
        <DeviceCheck
          session={session}
          capture={capture({ state: "requesting" })}
          onEnter={vi.fn()}
        />,
      );

      expect(screen.getByText("0 of 4")).toBeInTheDocument();
      expect(within(row("Your microphone")).getByText(/has to actually move/i)).toBeInTheDocument();
      expect(
        within(row("The interviewer's voice")).getByText(/will say hello/i),
      ).toBeInTheDocument();

      // Still nothing after long enough for every downstream check to have run.
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(screen.getByText("0 of 4")).toBeInTheDocument();
    });

    it("works through the rest once the microphone is live, and finishes", async () => {
      render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

      expect(await screen.findByText("4 of 4", undefined, { timeout: 4_000 })).toBeInTheDocument();
      expect(within(row("Your microphone")).getByText(/heard you/i)).toBeInTheDocument();
      expect(
        screen.getByText(/a couple of things work differently on this browser/i),
      ).toBeInTheDocument();
    });
  });

  describe("the microphone check", () => {
    /**
     * Permission is not proof. A muted headset, a microphone another app has taken, and a
     * device that simply is not the one selected all pass the browser's grant and ruin the
     * round — so nothing is called working until the meter has genuinely moved.
     */
    it("does not pass on permission alone, only on hearing something", async () => {
      render(<DeviceCheck session={session} capture={capture({ level: 0 })} onEnter={vi.fn()} />);

      await waitFor(() =>
        expect(
          within(row("Microphone access")).getByText(/handed over your microphone/i),
        ).toBeInTheDocument(),
      );

      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(within(row("Your microphone")).getByText(/say something/i)).toBeInTheDocument();
      expect(screen.getByText("1 of 4")).toBeInTheDocument();
    });

    /**
     * A candidate in a shared office may not want to talk to their laptop yet, and the
     * sequence must not stall behind them. Hearing nothing is a note, never a failure.
     */
    it("gives up listening rather than stalling, and still lets them in", async () => {
      vi.useFakeTimers();
      render(<DeviceCheck session={session} capture={capture({ level: 0 })} onEnter={vi.fn()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(within(row("Your microphone")).getByText(/nothing yet/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /enter the room/i })).toBeEnabled();
    });
  });

  describe("the interviewer's voice", () => {
    it("is actually spoken, so the candidate hears it before the round rather than during", async () => {
      const spoken = stubSynthesiser([{ name: "Microsoft Aria Online (Natural)", lang: "en-IN" }]);
      render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

      await waitFor(
        () =>
          expect(spoken).toContain("Hello — I'll be your interviewer today. Can you hear me?"),
        { timeout: 4_000 },
      );
      expect(
        within(row("The interviewer's voice")).getByText(/speaking from your own browser/i),
      ).toBeInTheDocument();
      expect(within(row("The interviewer's voice")).getByRole("button", { name: /say that again/i })).toBeInTheDocument();
    });

    /**
     * No local voice is a fact about the browser, not a fault. The round falls back to the
     * voice synthesised on the server, so the check reports that and entry stays open.
     */
    it("reports the server fallback honestly instead of failing", async () => {
      render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

      expect(
        await screen.findByText(/synthesised on our side instead/i, undefined, { timeout: 4_000 }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /enter the room/i })).toBeEnabled();
    });
  });

  /** Chrome and Edge only. Everywhere else the round runs exactly as it always has. */
  it("says whether this browser can mirror the candidate's words, without treating it as a fault", async () => {
    render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

    expect(
      await screen.findByText(/cannot mirror your words back/i, undefined, { timeout: 4_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter the room/i })).toBeEnabled();
  });

  describe("the camera", () => {
    const seen: SessionView = { ...session, consentVideo: true };
    const withCamera = () =>
      capture({
        stream: { getVideoTracks: () => [{}] } as unknown as MediaStream,
      });

    /**
     * The camera is shown and never recorded, and this screen is where a candidate decides
     * what to believe about that. The previous version of it said the camera was
     * "recording with the round", which was untrue the day it was written.
     */
    it("shows the preview and promises, in as many words, that nothing from it is kept", async () => {
      render(<DeviceCheck session={seen} capture={withCamera()} onEnter={vi.fn()} />);

      expect(screen.getByLabelText("Your camera preview")).toBeInTheDocument();
      expect(
        screen.getByText(/nothing from the camera is uploaded, recorded or scored/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/recording with the round/i)).not.toBeInTheDocument();

      expect(await screen.findByText("5 of 5", undefined, { timeout: 4_000 })).toBeInTheDocument();
      expect(within(row("Camera")).getByText(/never leaves this browser/i)).toBeInTheDocument();
    });

    it("puts the candidate's name on their own tile", async () => {
      render(<DeviceCheck session={seen} capture={withCamera()} onEnter={vi.fn()} />);

      expect(await screen.findByText("Naman")).toBeInTheDocument();
    });

    /** Nothing to show, so nothing is shown — not an empty box where a face would be. */
    it("is absent entirely when video was not consented to", () => {
      render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

      expect(screen.queryByLabelText("Your camera preview")).not.toBeInTheDocument();
      expect(screen.queryByText("Camera")).not.toBeInTheDocument();
    });
  });

  it("tells the candidate what asking for help costs, before they can ask", () => {
    render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

    expect(screen.getByText(/it is recorded, and the report says so/i)).toBeInTheDocument();
  });
});
