"use client";

import { useCallback, useId, useState } from "react";

import { checkNewBadges, XP_PER_CORRECT, type BadgeDefinition } from "@/lib/arena/progression";
import { useArenaProgress } from "@/lib/arena/progress-store";
import { scheduleNext } from "@/lib/arena/scheduler";
import { pickSessionChallenges, SESSION_SIZE } from "@/lib/arena/session";
import type { ArenaProgress } from "@/lib/arena/storage";
import type { Challenge } from "@/lib/arena/types";

/**
 * All the state one Arena run needs (task 055, §1-3): which challenges make up this run,
 * where the learner is in it, and — on every submitted answer — the new FSRS card and
 * mastery, saved to the account.
 *
 * XP and the streak are no longer computed here. The server decides both and returns them,
 * so a client cannot post itself a level; `XP_PER_CORRECT` survives only to label the
 * "+XP" shown during a run.
 *
 * Persistence happens directly inside the `submit`/`next` event handlers rather than in a
 * `useEffect` reacting to state changes: an effect there would run a render late for no
 * benefit, since the handler already knows exactly what just happened and why.
 */

export interface AnswerRecord {
  challengeId: string;
  correct: boolean;
}

export interface UseArenaSessionResult {
  challenge: Challenge | undefined;
  index: number;
  total: number;
  selected: number | null;
  submitted: boolean;
  /** Whether the just-submitted answer was correct. `null` before a submission. */
  wasCorrect: boolean | null;
  correctCount: number;
  finished: boolean;
  xpGainedThisSession: number;
  /** Every answer given so far this run, in order — the result screen uses this to link
   * back to the chapters behind whatever was answered incorrectly. */
  answers: AnswerRecord[];
  progress: ArenaProgress;
  newBadges: BadgeDefinition[];
  /** True once an answer has failed to save, so the run can say so rather than pretend. */
  saveFailed: boolean;
  select: (index: number) => void;
  submit: () => void;
  next: () => void;
}

export function useArenaSession(
  allChallenges: Challenge[],
  courseSlug?: string,
  selectionMode: "scheduled" | "fixed" = "scheduled",
): UseArenaSessionResult {
  const seed = useId();
  const { progress, recordAnswer, awardBadges } = useArenaProgress();

  // Which challenges the run is made of, computed once at mount from the schedule as it
  // stood then. A lazy `useState` initialiser (never a ref written during render) is the
  // React-sanctioned place for this kind of one-time setup. The caller does not mount this
  // until progress has loaded, so the due cards are real rather than an empty guess.
  const [challenges] = useState<Challenge[]>(() =>
    selectionMode === "fixed"
      ? allChallenges
      : pickSessionChallenges(allChallenges, progress.cards, new Date(), `session-${seed}`, SESSION_SIZE, courseSlug),
  );
  const [saveFailed, setSaveFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const [newBadges, setNewBadges] = useState<BadgeDefinition[]>([]);

  const challenge = challenges[index];

  const select = useCallback(
    (i: number) => {
      if (submitted) return;
      setSelected(i);
    },
    [submitted],
  );

  const submit = useCallback(() => {
    if (submitted || selected === null || !challenge) return;
    const correct = selected === challenge.correctIndex;
    const now = new Date();

    setSubmitted(true);
    setAnswers((prev) => [...prev, { challengeId: challenge.id, correct }]);

    const nextCard = scheduleNext(progress.cards[challenge.id], correct, now);
    void recordAnswer(challenge.id, correct, nextCard, now).then((ok) => {
      if (!ok) setSaveFailed(true);
    });
  }, [submitted, selected, challenge, progress.cards, recordAnswer]);

  const next = useCallback(() => {
    if (!submitted) return;
    const atEnd = index + 1 >= challenges.length;
    if (!atEnd) {
      setIndex((i) => i + 1);
      setSelected(null);
      setSubmitted(false);
      return;
    }

    setFinished(true);
    const earned = checkNewBadges(
      { streak: progress.streak, masteredChallengeIds: progress.masteredChallengeIds, allChallenges },
      progress.badges,
    );
    if (earned.length === 0) return;
    setNewBadges(earned);
    void awardBadges(earned.map((b) => b.id));
  }, [submitted, index, challenges.length, allChallenges, progress, awardBadges]);

  const correctCount = answers.filter((a) => a.correct).length;

  return {
    challenge,
    index,
    total: challenges.length,
    selected,
    submitted,
    wasCorrect: submitted ? (answers[index]?.correct ?? null) : null,
    correctCount,
    finished,
    xpGainedThisSession: correctCount * XP_PER_CORRECT,
    answers,
    progress,
    newBadges,
    saveFailed,
    select,
    submit,
    next,
  };
}
