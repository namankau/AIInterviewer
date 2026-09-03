import { describe, expect, it } from "vitest";

import {
  MINIMUM_ANSWER_MS,
  SILENCE_TO_END_MS,
  SPEECH_LEVEL,
  initialSilenceState,
  observe,
  shouldEnd,
} from "./silence";

const LOUD = SPEECH_LEVEL + 0.2;
const QUIET = SPEECH_LEVEL - 0.02;

/** Feeds a run of readings in, one every `stepMs`, and returns where it ends up. */
function run(levels: number[], from = 0, stepMs = 100) {
  let state = initialSilenceState;
  let now = from;
  for (const level of levels) {
    state = observe(state, level, now);
    now += stepMs;
  }
  return { state, now };
}

describe("ending an answer on silence", () => {
  it("waits indefinitely for someone who has not started", () => {
    // A candidate thinking for twenty seconds before their first word is doing the
    // right thing. Cutting them off there would be the worst failure this has.
    const { state, now } = run(Array(200).fill(QUIET));

    expect(state.hasSpoken).toBe(false);
    expect(shouldEnd(state, now, 0)).toBe(false);
  });

  it("ends once they have spoken and then stopped", () => {
    const { state, now } = run([...Array(10).fill(LOUD), ...Array(40).fill(QUIET)]);

    expect(state.hasSpoken).toBe(true);
    expect(shouldEnd(state, now, 0)).toBe(true);
  });

  it("treats a pause for thought as part of the answer", () => {
    const pauseTicks = Math.floor(SILENCE_TO_END_MS / 100) - 5;
    const { state, now } = run([...Array(5).fill(LOUD), ...Array(pauseTicks).fill(QUIET)]);

    expect(shouldEnd(state, now, 0)).toBe(false);
  });

  it("starts the silence over when they speak again", () => {
    let state = initialSilenceState;
    state = observe(state, LOUD, 0);
    state = observe(state, QUIET, 1_000);
    expect(state.silentSince).toBe(1_000);

    state = observe(state, LOUD, 2_000);
    expect(state.silentSince).toBeNull();

    state = observe(state, QUIET, 2_100);
    expect(state.silentSince).toBe(2_100);
    expect(shouldEnd(state, 2_100 + SILENCE_TO_END_MS - 1, 0)).toBe(false);
    expect(shouldEnd(state, 2_100 + SILENCE_TO_END_MS, 0)).toBe(true);
  });

  it("never ends an answer in its opening moments", () => {
    // A cough at the microphone as recording opens should not submit an empty answer.
    const state = observe(observe(initialSilenceState, LOUD, 0), QUIET, 10);

    expect(shouldEnd(state, MINIMUM_ANSWER_MS - 1, 0)).toBe(false);
  });
});
