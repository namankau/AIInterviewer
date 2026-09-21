"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";

import { ChallengeCard } from "@/components/arena/challenge-card";
import { celebrate } from "@/lib/arena/celebrate";
import { levelForXp } from "@/lib/arena/progression";
import { useArenaSession, type AnswerRecord } from "@/lib/arena/use-arena-session";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { Challenge } from "@/lib/arena/types";

/**
 * One Arena run, start to finish (task 055, §1): one challenge on screen at a time, a
 * visible run of correct answers, and a result screen naming exactly what to revise —
 * every derived challenge already carries a link back to the chapter that teaches it.
 */
export function ArenaSession({ challenges, courseSlug }: { challenges: Challenge[]; courseSlug?: string }) {
  const session = useArenaSession(challenges, courseSlug);
  const reducedMotion = usePrefersReducedMotion();
  const celebratedRef = useRef(false);

  const isPerfectRun = session.total > 0 && session.correctCount === session.total;
  useEffect(() => {
    if (session.finished && !celebratedRef.current && (session.newBadges.length > 0 || isPerfectRun)) {
      celebratedRef.current = true;
      celebrate(reducedMotion);
    }
  }, [session.finished, session.newBadges.length, isPerfectRun, reducedMotion]);

  if (session.total === 0) {
    return (
      <p className="max-w-prose text-body text-ink-muted">
        There is nothing to practise here yet — come back once this course has a chapter or two written.
      </p>
    );
  }

  if (session.finished) {
    return (
      <ResultScreen
        challenges={challenges}
        courseSlug={courseSlug}
        correctCount={session.correctCount}
        total={session.total}
        xpGained={session.xpGainedThisSession}
        totalXp={session.progress.xp}
        streakDays={session.progress.streak.current}
        newBadges={session.newBadges}
        answers={session.answers}
      />
    );
  }

  if (!session.challenge) return null;

  return (
    <div className="flex flex-col gap-6">
      <ProgressDots total={session.total} index={session.index} correctCount={session.correctCount} />
      <ChallengeCard
        challenge={session.challenge}
        selected={session.selected}
        submitted={session.submitted}
        wasCorrect={session.wasCorrect}
        onSelect={session.select}
        onSubmit={session.submit}
        onNext={session.next}
      />
    </div>
  );
}

function ProgressDots({ total, index, correctCount }: { total: number; index: number; correctCount: number }) {
  return (
    <div className="flex items-center gap-3">
      <ul className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={[
              "h-1.5 w-6 rounded-full",
              i < index ? "bg-positive" : i === index ? "bg-accent" : "bg-line-strong",
            ].join(" ")}
          />
        ))}
      </ul>
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
        {index + 1} of {total} · {correctCount} correct
      </p>
    </div>
  );
}

function ResultScreen({
  challenges,
  courseSlug,
  correctCount,
  total,
  xpGained,
  totalXp,
  streakDays,
  newBadges,
  answers,
}: {
  challenges: Challenge[];
  courseSlug: string | undefined;
  correctCount: number;
  total: number;
  xpGained: number;
  totalXp: number;
  streakDays: number;
  newBadges: { id: string; title: string; description: string }[];
  answers: AnswerRecord[];
}) {
  const level = levelForXp(totalXp);
  const byId = new Map(challenges.map((c) => [c.id, c]));
  const wrongChapterKeys = new Set<string>();
  for (const answer of answers) {
    if (answer.correct) continue;
    const challenge = byId.get(answer.challengeId);
    if (challenge) wrongChapterKeys.add(`${challenge.courseSlug}/${challenge.chapterSlug}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Run complete</p>
        <h2 className="text-title text-ink">
          {correctCount} of {total} correct
        </h2>
        <p className="text-caption text-ink-muted">
          +{xpGained} XP this run · Level {level.level} · {streakDays}-day streak
        </p>
      </div>

      {newBadges.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-highlight/40 bg-highlight/10 px-5 py-4">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            New badge{newBadges.length > 1 ? "s" : ""}
          </p>
          <ul className="flex flex-col gap-1">
            {newBadges.map((badge) => (
              <li key={badge.id} className="text-body font-medium text-ink">
                {badge.title} <span className="text-caption font-normal text-ink-muted">— {badge.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {wrongChapterKeys.size === 0 ? (
        <p className="text-body text-positive">Everything in this run, correct. Nothing to revise.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Worth revising</p>
          <ul className="flex flex-col gap-1.5">
            {Array.from(wrongChapterKeys).map((key) => {
              const [course, chapter] = key.split("/");
              return (
                <li key={key}>
                  <Link href={`/courses/${course}/${chapter}` as Route} className="text-body text-accent hover:underline">
                    {course}/{chapter}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={(courseSlug ? `/arena/${courseSlug}` : "/arena") as Route}
          className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-white transition-colors hover:bg-accent-strong"
        >
          Play again
        </Link>
        <Link href="/arena" className="text-caption font-medium text-accent hover:underline">
          Back to Arena
        </Link>
      </div>
    </div>
  );
}
