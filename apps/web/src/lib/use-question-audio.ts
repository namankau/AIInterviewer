"use client";

import type { SpeechStatus, TurnView } from "@acemyinterview/shared";
import { useEffect, useState } from "react";

import { fetchTurn } from "@/lib/api";

/**
 * How often to ask whether the interviewer's voice has finished rendering, and how long
 * to keep asking.
 *
 * The interval was loose when the candidate already had the question in writing and this
 * was only catching up. It is not that any more: the room now waits for the voice before
 * showing anything, so every 100ms of poll granularity is 100ms of the candidate looking
 * at a blank screen. Tight enough to be invisible, still cheap — it is one small
 * authenticated GET against our own API, not a model call.
 *
 * The ceiling exists so a synthesis that dies without ever writing its state back — a
 * crashed worker, a lost database write — cannot leave a tab polling all evening.
 */
const POLL_INTERVAL_MS = 400;
const POLL_CEILING_MS = 45_000;

export interface QuestionAudio {
  /** The URL to play, once there is one. */
  url: string | null;
  /** `pending` while the voice is still rendering; the room says so rather than sitting mute. */
  status: SpeechStatus;
}

/**
 * Follows one question's audio from "still rendering" to "ready" or "not coming".
 *
 * Speech is synthesised after the question text has already been sent (see
 * `QuestionSpeech` on the API), which is what took roughly half the wait out of a turn.
 * The cost is that the room has to collect it, which is what this does.
 */
export function useQuestionAudio({
  sessionId,
  turn,
  accessToken,
}: {
  sessionId: string;
  turn: TurnView | null;
  /** `undefined` while the session is still being read — see useAccessToken. */
  accessToken: string | null | undefined;
}): QuestionAudio {
  // The turn a resolved voice belongs to is kept alongside it, so a new question falls
  // back to its own state during the same render. Clearing it in an effect instead would
  // hand the room turn 2's audio for one frame of turn 3, and play the wrong question.
  const [resolved, setResolved] = useState<{ turnIndex: number; audio: QuestionAudio } | null>(null);

  const turnIndex = turn?.turnIndex ?? null;
  const initialStatus = turn?.questionAudioStatus ?? "unavailable";

  useEffect(() => {
    if (!accessToken || turnIndex === null || initialStatus !== "pending") return;

    let active = true;
    const startedAt = Date.now();

    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_CEILING_MS) {
        clearInterval(timer);
        if (active) setResolved({ turnIndex, audio: { url: null, status: "unavailable" } });
        return;
      }

      try {
        const latest = await fetchTurn(sessionId, turnIndex, { accessToken });
        if (!active || latest.questionAudioStatus === "pending") return;
        clearInterval(timer);
        setResolved({
          turnIndex,
          audio: { url: latest.questionAudioUrl, status: latest.questionAudioStatus },
        });
      } catch {
        // A failed poll is not worth reporting: the question is on screen either way,
        // and the next tick will try again until the ceiling stops it.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [accessToken, sessionId, turnIndex, initialStatus]);

  if (resolved && resolved.turnIndex === turnIndex) return resolved.audio;
  return { url: turn?.questionAudioUrl ?? null, status: initialStatus };
}
