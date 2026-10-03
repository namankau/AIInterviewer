import { describe, expect, it } from "vitest";

import { SPEECH_LEVEL } from "@/lib/silence";
import { finishTiming, foldLevel, startTiming, type TimingState } from "@/lib/speech-timing";

const LOUD = SPEECH_LEVEL + 0.1;
const QUIET = 0;

/** Feeds a reading every `step` ms, loud wherever `speaking(t)` says so, from 0 up to `until`. */
function run(until: number, speaking: (t: number) => boolean, step = 50): TimingState {
  let state = startTiming(0);
  for (let t = step; t <= until; t += step) {
    state = foldLevel(state, speaking(t) ? LOUD : QUIET, t);
  }
  return state;
}

describe("speech timing", () => {
  it("measures the wait before the first word, the speaking span and its pauses", () => {
    // Silent for 2 s, speaks to 6 s, pauses 1.5 s, speaks to 10 s, then 3 s of silence.
    const speaking = (t: number) => (t >= 2_000 && t <= 6_000) || (t >= 7_500 && t <= 10_000);
    const timing = finishTiming(run(13_000, speaking), 13_000);

    expect(timing).toEqual({
      recordedMs: 13_000,
      firstSoundMs: 2_000,
      speakingMs: 8_000,
      pauseCount: 1,
      longestPauseMs: 1_500,
      totalPauseMs: 1_500,
    });
  });

  it("does not count the gaps between words as pauses", () => {
    // Speech with a 300 ms dip every second, as between words and phrases.
    const speaking = (t: number) => t >= 1_000 && t <= 9_000 && t % 1_000 >= 300;
    const timing = finishTiming(run(10_000, speaking), 10_000);

    expect(timing?.pauseCount).toBe(0);
    expect(timing?.totalPauseMs).toBe(0);
  });

  it("an answer that was all silence has no first word and nothing to pace", () => {
    const timing = finishTiming(run(8_000, () => false), 8_000);

    expect(timing).toEqual({
      recordedMs: 8_000,
      firstSoundMs: null,
      speakingMs: 0,
      pauseCount: 0,
      longestPauseMs: 0,
      totalPauseMs: 0,
    });
  });

  it("a very short answer is still measured, and the server decides it is too short to pace", () => {
    const timing = finishTiming(run(1_200, (t) => t >= 400 && t <= 800), 1_200);

    expect(timing).toMatchObject({ firstSoundMs: 400, speakingMs: 400, pauseCount: 0 });
  });

  it("sends nothing when the meter stopped sampling, rather than calling the gap a pause", () => {
    let state = startTiming(0);
    state = foldLevel(state, LOUD, 100);
    // A background tab: no frames for two seconds.
    state = foldLevel(state, LOUD, 2_100);

    expect(finishTiming(state, 2_200)).toBeNull();
  });

  it("sends nothing when the meter went quiet before the answer was stopped", () => {
    const state = foldLevel(startTiming(0), LOUD, 100);

    expect(finishTiming(state, 5_000)).toBeNull();
  });

  it("a zero-length recording is not a measurement", () => {
    expect(finishTiming(startTiming(0), 0)).toBeNull();
  });
});
