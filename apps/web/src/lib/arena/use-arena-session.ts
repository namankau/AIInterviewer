"use client";

import { useCallback, useId, useState } from "react";

import { checkNewBadges, recordActivity, XP_PER_CORRECT, type BadgeDefinition } from "@/lib/arena/progression";
import { scheduleNext } from "@/lib/arena/scheduler";
import { pickSessionChallenges, SESSION_SIZE } from "@/lib/arena/session";
import { loadProgress, saveProgress, type ArenaProgress } from "@/lib/arena/storage";
import type { Challenge } from "@/lib/arena/types";

/**
 * All the state one Arena run needs (task 055, §1-3): which challenges make up this run,
 * where the learner is in it, and — on every submitted answer — updating the FSRS card,
 * XP, mastery and streak in `localStorage`.
 *
 * Persistence happens directly inside the `submit`/`next` event handlers rather than in a
 * `useEffect` reacting to state changes: an effect here would run a render late for no
 * benefit, since nothing external is being subscribed to — the handler already knows
 * exactly what just happened and why.
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
  select: (index: number) => void;
  submit: () => void;
  next: () => void;
}

export function useArenaSession(allChallenges: Challenge[], courseSlug?: string): UseArenaSessionResult {
  const seed = useId();

  // Computed once, at mount: which progress this run starts from, and which challenges
  // it's made of. A lazy `useState` initialiser (never a ref written during render) is
  // the React-sanctioned place for this kind of one-time setup.
  const [initial] = useState(() => {
    const initialProgress = loadProgress();
    const challenges = pickSessionChallenges(
      allChallenges,
      initialProgress.cards,
      new Date(),
      `session-${seed}`,
      SESSION_SIZE,
      courseSlug,
    );
    return { progress: initialProgress, challenges };
  });

  const [progress, setProgress] = useState<ArenaProgress>(initial.progress);
  const [challenges] = useState<Challenge[]>(initial.challenges);
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
    setProgress((prev) => {
      const nextCard = scheduleNext(prev.cards[challenge.id], correct, now);
      const cards = { ...prev.cards, [challenge.id]: nextCard };
      const xp = prev.xp + (correct ? XP_PER_CORRECT : 0);
      const masteredChallengeIds =
        correct && !prev.masteredChallengeIds.includes(challenge.id)
          ? [...prev.masteredChallengeIds, challenge.id]
          : prev.masteredChallengeIds;
      const streak = recordActivity(prev.streak, now);
      const updated: ArenaProgress = { ...prev, xp, cards, masteredChallengeIds, streak };
      saveProgress(updated);
      return updated;
    });
  }, [submitted, selected, challenge]);

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
    setProgress((prev) => {
      const earned = checkNewBadges(
        { streak: prev.streak, masteredChallengeIds: prev.masteredChallengeIds, allChallenges },
        prev.badges,
      );
      if (earned.length === 0) return prev;
      setNewBadges(earned);
      const updated: ArenaProgress = { ...prev, badges: [...prev.badges, ...earned.map((b) => b.id)] };
      saveProgress(updated);
      return updated;
    });
  }, [submitted, index, challenges.length, allChallenges]);

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
    select,
    submit,
    next,
  };
}
