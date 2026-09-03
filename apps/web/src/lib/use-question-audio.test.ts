import type { TurnView } from "@acemyinterview/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuestionAudio } from "./use-question-audio";

const fetchTurn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ fetchTurn }));

const SESSION = "3f5a1b2c-0d4e-4f6a-9b8c-1d2e3f4a5b6c";

function turn(overrides: Partial<TurnView> = {}): TurnView {
  return {
    turnIndex: 1,
    questionText: "How did you handle the lag in that pipeline?",
    questionAudioUrl: null,
    questionAudioStatus: "pending",
    phase: "main",
    answered: false,
    ...overrides,
  };
}

describe("useQuestionAudio", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchTurn.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Fake timers and `waitFor` do not mix — `waitFor` polls on a clock this test owns and
   * never advances. Driving the clock inside `act` settles both the poll and the React
   * state it causes, so assertions can be made directly afterwards.
   */
  async function elapse(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("plays a voice that is already rendered without asking the API", () => {
    const { result } = renderHook(() =>
      useQuestionAudio({
        sessionId: SESSION,
        turn: turn({ questionAudioStatus: "ready", questionAudioUrl: "https://audio.test/q1.wav" }),
        accessToken: "token",
      }),
    );

    expect(result.current).toEqual({ url: "https://audio.test/q1.wav", status: "ready" });
    expect(fetchTurn).not.toHaveBeenCalled();
  });

  it("collects the voice once it has rendered", async () => {
    fetchTurn
      .mockResolvedValueOnce(turn())
      .mockResolvedValueOnce(turn({ questionAudioStatus: "ready", questionAudioUrl: "https://audio.test/q1.wav" }));

    const { result } = renderHook(() =>
      useQuestionAudio({ sessionId: SESSION, turn: turn(), accessToken: "token" }),
    );

    expect(result.current.status).toBe("pending");

    await elapse(3_000);

    expect(result.current.status).toBe("ready");
    expect(result.current.url).toBe("https://audio.test/q1.wav");
  });

  /**
   * A round whose speech never renders must still be answerable. The question is on
   * screen in writing, so the only thing that could go wrong here is the room waiting
   * forever on a voice that is not coming.
   */
  it("gives up rather than polling forever", async () => {
    fetchTurn.mockResolvedValue(turn());

    const { result } = renderHook(() =>
      useQuestionAudio({ sessionId: SESSION, turn: turn(), accessToken: "token" }),
    );

    await elapse(60_000);

    expect(result.current.status).toBe("unavailable");
    const callsAtGiveUp = fetchTurn.mock.calls.length;

    await elapse(30_000);
    expect(fetchTurn.mock.calls.length).toBe(callsAtGiveUp);
  });

  it("does not carry one question's audio over to the next", async () => {
    fetchTurn.mockResolvedValue(
      turn({ questionAudioStatus: "ready", questionAudioUrl: "https://audio.test/q1.wav" }),
    );

    const { result, rerender } = renderHook((props: { turn: TurnView }) =>
      useQuestionAudio({ sessionId: SESSION, turn: props.turn, accessToken: "token" }),
      { initialProps: { turn: turn() } },
    );

    await elapse(2_000);
    expect(result.current.url).toBe("https://audio.test/q1.wav");

    act(() => rerender({ turn: turn({ turnIndex: 2 }) }));

    // Turn 2 has no voice yet — showing turn 1's would play the wrong question.
    expect(result.current.url).toBeNull();
    expect(result.current.status).toBe("pending");
  });

  it("stays put until there is a token to ask with", async () => {
    renderHook(() => useQuestionAudio({ sessionId: SESSION, turn: turn(), accessToken: undefined }));

    await elapse(5_000);
    expect(fetchTurn).not.toHaveBeenCalled();
  });
});
