"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The small sounds a listener makes.
 *
 * A real interviewer says "mm-hm" and "right" while you talk, and their absence is most
 * of why speaking into this felt like dictating into a void: nothing confirmed the
 * candidate was being heard until the next question arrived, ten seconds after they
 * stopped.
 *
 * Two moments, with different rules:
 *
 * - **While they are still speaking**, a short acknowledgement drops into a pause. It
 *   has to be brief and quiet enough not to take the floor, and rare enough not to
 *   become a tic.
 * - **The instant they stop**, one longer acknowledgement plays while the model is still
 *   thinking. This is the one that matters most — it turns a dead ten-second gap into a
 *   person who heard you and is considering it.
 *
 * The clips are static files rendered ahead of time (`scripts/make-backchannel.mjs`). A
 * backchannel that arrives after a round trip to a model is not a backchannel.
 */

const LISTENING = [
  "/interviewer/listening-1.wav",
  "/interviewer/listening-2.wav",
  "/interviewer/listening-3.wav",
  "/interviewer/listening-4.wav",
];

const ACKNOWLEDGING = [
  "/interviewer/acknowledging-1.wav",
  "/interviewer/acknowledging-2.wav",
  "/interviewer/acknowledging-3.wav",
];

/** How long a pause has to run before it is long enough to speak into. */
const PAUSE_BEFORE_LISTENING_MS = 1_100;

/** The floor between two listening noises. Below this it stops reading as listening. */
const MINIMUM_GAP_MS = 9_000;

/** Nothing is said over the opening of an answer, however hesitant it is. */
const QUIET_OPENING_MS = 6_000;

/** Under the candidate's voice, not over it. */
const LISTENING_VOLUME = 0.35;
const ACKNOWLEDGING_VOLUME = 0.6;

export interface Backchannel {
  /**
   * True while a clip is playing.
   *
   * The room stops trusting its meter while this is true. Echo cancellation should keep
   * the clip out of the microphone, but "should" is not a basis for a silence detector
   * that decides when someone has finished speaking.
   */
  speaking: boolean;
  /** Fold one meter reading in. Plays into a pause when the rules allow it. */
  observe: (level: number, speechLevel: number) => void;
  /** The candidate has stopped. Acknowledge it while the model thinks. */
  acknowledge: () => void;
  /** Answer over: forget everything and go quiet. */
  reset: () => void;
}

export function useBackchannel({ enabled }: { enabled: boolean }): Backchannel {
  const [speaking, setSpeaking] = useState(false);

  const audio = useRef<HTMLAudioElement | null>(null);
  const lastPlayedAt = useRef(0);
  const silentSince = useRef<number | null>(null);
  // Set on the first reading rather than at render: a clock read during render is not
  // idempotent, and this one only has to mean "when the answer started".
  const startedAt = useRef<number | null>(null);
  const hasSpoken = useRef(false);
  // Rotated rather than picked at random: it cannot repeat itself twice running, which
  // is the one thing that would make these read as a recording rather than a listener.
  const nextClip = useRef(0);

  const play = useCallback((choices: string[], volume: number) => {
    // Never stack two. A second clip over the first is not a listener, it is a glitch.
    if (audio.current || choices.length === 0) return;

    const src = choices[nextClip.current % choices.length] as string;
    nextClip.current += 1;
    lastPlayedAt.current = Date.now();

    const element = new Audio(src);
    element.volume = volume;
    audio.current = element;
    setSpeaking(true);

    const done = () => {
      audio.current = null;
      setSpeaking(false);
    };
    element.addEventListener("ended", done, { once: true });
    element.addEventListener("error", done, { once: true });
    // A blocked play is not worth surfacing: the round is unaffected and the candidate
    // has lost nothing but a noise.
    element.play().catch(done);
  }, []);

  const observe = useCallback(
    (level: number, speechLevel: number) => {
      if (!enabled) return;
      const now = Date.now();
      startedAt.current ??= now;

      if (level >= speechLevel) {
        hasSpoken.current = true;
        silentSince.current = null;
        return;
      }
      if (!hasSpoken.current) return;

      silentSince.current ??= now;
      if (now - (startedAt.current ?? now) < QUIET_OPENING_MS) return;
      if (now - lastPlayedAt.current < MINIMUM_GAP_MS) return;
      if (now - silentSince.current < PAUSE_BEFORE_LISTENING_MS) return;

      play(LISTENING, LISTENING_VOLUME);
      // Count this pause as spoken for, so one long think does not draw a second noise.
      silentSince.current = null;
    },
    [enabled, play],
  );

  const acknowledge = useCallback(() => {
    if (!enabled) return;
    play(ACKNOWLEDGING, ACKNOWLEDGING_VOLUME);
  }, [enabled, play]);

  const reset = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setSpeaking(false);
    silentSince.current = null;
    hasSpoken.current = false;
    startedAt.current = null;
    lastPlayedAt.current = 0;
  }, []);

  // Leaving the room mid-clip should not leave a voice playing to an empty page.
  useEffect(() => () => audio.current?.pause(), []);

  return { speaking, observe, acknowledge, reset };
}
