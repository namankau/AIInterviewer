/**
 * Deciding when a spoken answer has ended.
 *
 * Clicking "done answering" is the tell that this is a form rather than an interview:
 * nobody presses a button when they stop talking to a person. The round should notice
 * the silence itself.
 *
 * Getting this wrong in either direction is costly, so the rules are deliberately
 * conservative:
 *
 * - **Never cut someone off who has not started.** A candidate who takes ten seconds to
 *   think before their first word is doing the right thing, and the clock on silence
 *   does not start until they have actually spoken.
 * - **Never mistake a pause for an ending.** People pause mid-answer to think, and
 *   under pressure they pause for longer than they realise. The window is well past
 *   conversational, and any sound at all resets it.
 * - **Always leave a way out.** This is an aid to a manual control, not a replacement
 *   for one — the room keeps its button.
 */

/** Level above which we treat the microphone as carrying speech rather than room noise. */
export const SPEECH_LEVEL = 0.08;

/** How long a silence has to last, once they have spoken, before the answer is taken as finished. */
export const SILENCE_TO_END_MS = 3_500;

/** Nothing ends an answer in its first moments, however quiet it is. */
export const MINIMUM_ANSWER_MS = 2_000;

/**
 * Sound must persist this long before it counts as the candidate starting. A chair bump,
 * notification or one noisy analyser frame must not begin the silence countdown while
 * somebody is still thinking about the question.
 */
export const SPEECH_TO_START_MS = 400;

export interface SilenceState {
  /** Whether the candidate has said anything at all yet. */
  hasSpoken: boolean;
  /** When the current run of silence began, or null if sound is being heard. */
  silentSince: number | null;
  /** When sustained sound began, until it is long enough to count as speech. */
  loudSince: number | null;
}

export const initialSilenceState: SilenceState = { hasSpoken: false, silentSince: null, loudSince: null };

/**
 * Folds one meter reading into the running state. Pure, so the thresholds above can be
 * tested without a microphone.
 */
export function observe(state: SilenceState, level: number, now: number): SilenceState {
  if (level >= SPEECH_LEVEL) {
    if (state.hasSpoken) return { hasSpoken: true, silentSince: null, loudSince: null };
    const loudSince = state.loudSince ?? now;
    if (now - loudSince >= SPEECH_TO_START_MS) {
      return { hasSpoken: true, silentSince: null, loudSince: null };
    }
    return { hasSpoken: false, silentSince: null, loudSince };
  }
  if (!state.hasSpoken) {
    return state.loudSince === null ? state : { ...state, loudSince: null };
  }
  return { hasSpoken: true, silentSince: state.silentSince ?? now, loudSince: null };
}

/** Whether the answer should now be submitted on its own. */
export function shouldEnd(state: SilenceState, now: number, startedAt: number): boolean {
  if (!state.hasSpoken || state.silentSince === null) return false;
  if (now - startedAt < MINIMUM_ANSWER_MS) return false;
  return now - state.silentSince >= SILENCE_TO_END_MS;
}
