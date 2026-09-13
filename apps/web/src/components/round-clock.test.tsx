import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoundClock } from "./round-clock";

/**
 * The round clock counts down to the server's deadline and says when it reaches zero.
 *
 * Reaching zero used to mean nothing: the round was only ended when the next answer
 * arrived at the server, so a five-minute round ran to 7:17 with the clock sat at 0:00.
 * The room now ends the round when this fires, so it has to fire — once.
 */
describe("RoundClock", () => {
  const now = new Date("2026-09-12T11:50:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const endsIn = (seconds: number) => new Date(now.getTime() + seconds * 1000).toISOString();

  it("counts down to the deadline it is given", () => {
    render(<RoundClock endsAt={endsIn(5 * 60)} phase="main" />);

    expect(screen.getByText("5:00")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(67_000));
    expect(screen.getByText("3:53")).toBeInTheDocument();
  });

  it("says so when it reaches zero, exactly once", () => {
    const onExpired = vi.fn();
    render(<RoundClock endsAt={endsIn(3)} phase="main" onExpired={onExpired} />);

    act(() => vi.advanceTimersByTime(2_000));
    expect(onExpired).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1_000));
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(screen.getByText("0:00")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10_000));
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  /** A reload after the deadline must still end the round, not leave it running. */
  it("fires straight away for a deadline already past", () => {
    const onExpired = vi.fn();
    render(<RoundClock endsAt={endsIn(-30)} phase="closing" onExpired={onExpired} />);

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it("follows a deadline that moves, as it does when the room is entered", () => {
    const onExpired = vi.fn();
    const { rerender } = render(<RoundClock endsAt={endsIn(2 * 60 + 10)} phase="main" onExpired={onExpired} />);
    expect(screen.getByText("2:10")).toBeInTheDocument();

    rerender(<RoundClock endsAt={endsIn(5 * 60)} phase="main" onExpired={onExpired} />);
    expect(screen.getByText("5:00")).toBeInTheDocument();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("never tells a screen reader there is more time than the clock shows", () => {
    render(<RoundClock endsAt={endsIn(4 * 60 + 1)} phase="main" />);

    expect(screen.getByLabelText("4 minutes 1 second left in this round")).toBeInTheDocument();
  });
});
