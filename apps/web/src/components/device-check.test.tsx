import type { SessionView } from "@acemyinterview/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeviceCheck } from "./device-check";
import type { useInterviewCapture } from "@/lib/use-interview-capture";

type Capture = ReturnType<typeof useInterviewCapture>;

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

describe("DeviceCheck", () => {
  it("asks for the devices on arrival, once", () => {
    const devices = capture();
    const { rerender } = render(
      <DeviceCheck session={session} capture={devices} onEnter={vi.fn()} />,
    );
    rerender(<DeviceCheck session={session} capture={devices} onEnter={vi.fn()} />);

    expect(devices.requestDevices).toHaveBeenCalledTimes(1);
  });

  it("lets the candidate in once the microphone is live", async () => {
    const onEnter = vi.fn();
    render(<DeviceCheck session={session} capture={capture()} onEnter={onEnter} />);

    await userEvent.click(screen.getByRole("button", { name: /enter the room/i }));

    expect(onEnter).toHaveBeenCalled();
  });

  /**
   * The round is spoken and a candidate gets one free one. Walking into it with a
   * blocked microphone would burn it, so entry is closed until the device works.
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

  it("says the camera is off when video was not consented to", () => {
    render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

    expect(screen.getByText(/you did not consent to video/i)).toBeInTheDocument();
  });

  it("tells the candidate what asking for help costs, before they can ask", () => {
    render(<DeviceCheck session={session} capture={capture()} onEnter={vi.fn()} />);

    expect(screen.getByText(/it is recorded, and the report says so/i)).toBeInTheDocument();
  });
});
