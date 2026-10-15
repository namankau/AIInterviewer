"use client";

import type { SpeechStatus, TurnView } from "@untiered/shared";
import { useEffect, useRef, useState } from "react";

import { fetchTurn } from "@/lib/api";

/**
 * How often to ask whether the interviewer's voice has finished rendering, and how long
 * to keep asking. Early checks stay quick; later checks back off while speech is slow.
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
function pollDelay(completedPolls: number): number {
  if (completedPolls < 5) return 400;
  if (completedPolls < 10) return 800;
  return 1_200;
}

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
  onPollTimeout,
}: {
  sessionId: string;
  turn: TurnView | null;
  /** `undefined` while the session is still being read — see useAccessToken. */
  accessToken: string | null | undefined;
  /** Privacy-safe telemetry hook; the room decides how to deliver it. */
  onPollTimeout?: (turnIndex: number, durationMs: number) => void;
}): QuestionAudio {
  // The turn a resolved voice belongs to is kept alongside it, so a new question falls
  // back to its own state during the same render. Clearing it in an effect instead would
  // hand the room turn 2's audio for one frame of turn 3, and play the wrong question.
  const [resolved, setResolved] = useState<{ turnIndex: number; audio: QuestionAudio } | null>(null);
  const onPollTimeoutRef = useRef(onPollTimeout);

  useEffect(() => {
    onPollTimeoutRef.current = onPollTimeout;
  }, [onPollTimeout]);

  const turnIndex = turn?.turnIndex ?? null;
  const initialStatus = turn?.questionAudioStatus ?? "unavailable";

  useEffect(() => {
    if (!accessToken || turnIndex === null || initialStatus !== "pending") return;

    let active = true;
    let completedPolls = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const controller = new AbortController();

    const stop = () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (deadlineTimer) clearTimeout(deadlineTimer);
      controller.abort();
    };

    const poll = async () => {
      if (!active) return;
      try {
        const latest = await fetchTurn(sessionId, turnIndex, { accessToken, signal: controller.signal });
        if (!active) return;
        if (latest.questionAudioStatus !== "pending") {
          stop();
          setResolved({
            turnIndex,
            audio: { url: latest.questionAudioUrl, status: latest.questionAudioStatus },
          });
          return;
        }
      } catch {
        // A failed poll is retried on the next tick until the ceiling stops it.
      }
      if (active) pollTimer = setTimeout(poll, pollDelay(++completedPolls));
    };

    pollTimer = setTimeout(poll, pollDelay(0));
    deadlineTimer = setTimeout(() => {
      if (!active) return;
      stop();
      onPollTimeoutRef.current?.(turnIndex, Date.now() - startedAt);
      setResolved({ turnIndex, audio: { url: null, status: "unavailable" } });
    }, POLL_CEILING_MS);

    return stop;
  }, [accessToken, sessionId, turnIndex, initialStatus]);

  if (resolved && resolved.turnIndex === turnIndex) return resolved.audio;
  return { url: turn?.questionAudioUrl ?? null, status: initialStatus };
}
