"use client";

import { useCallback, useState } from "react";

import { ChallengeCard } from "@/components/arena/challenge-card";
import { localDateKey } from "@/lib/arena/progression";
import { useArenaProgress } from "@/lib/arena/progress-store";
import { scheduleNext } from "@/lib/arena/scheduler";
import type { Challenge } from "@/lib/arena/types";

/**
 * One reviewed Arena question, stable for the learner's local calendar day. Completion
 * is account-backed, so a solved card stays green after refresh and on another device.
 */
export function DashboardQuestionOfDay({ questionsByDate }: { questionsByDate: Record<string, Challenge> }) {
  const [dateKey] = useState(() => localDateKey(new Date()));
  const question = questionsByDate[dateKey];
  const { progress, ready, status, recordAnswer } = useArenaProgress();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [completedNow, setCompletedNow] = useState(false);

  const completed = completedNow || progress.dailyQuestionCompletions[dateKey] !== undefined;

  const submit = useCallback(() => {
    if (!question || selected === null || submitted || saving) return;
    const correct = selected === question.correctIndex;
    const now = new Date();
    const nextCard = scheduleNext(progress.cards[question.id], correct, now);

    setSubmitted(true);
    setWasCorrect(correct);
    setSaving(true);
    setSaveFailed(false);
    void recordAnswer(question.id, correct, nextCard, now, correct ? dateKey : undefined).then((saved) => {
      setSaving(false);
      if (saved && correct) setCompletedNow(true);
      if (!saved) setSaveFailed(true);
    });
  }, [dateKey, progress.cards, question, recordAnswer, saving, selected, submitted]);

  const tryAgain = useCallback(() => {
    if (saving) return;
    setSelected(null);
    setSubmitted(false);
    setWasCorrect(null);
    setSaveFailed(false);
  }, [saving]);

  if (!question) return null;

  return (
    <section
      aria-labelledby="question-of-the-day-heading"
      className="rounded-3xl border border-accent/20 bg-accent-wash p-5 shadow-[var(--shadow-sm)] sm:p-7"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <p className="eyebrow text-accent">Daily practice</p>
          <h2 id="question-of-the-day-heading" className="mt-2 text-title text-ink">
            Question of the day
          </h2>
          <p className="mt-1 max-w-2xl text-caption text-ink-muted">
            One focused question, fixed for today. Solve it once and your dashboard keeps the win.
          </p>
        </div>
        <span className="pill w-fit bg-surface-raised text-ink-muted shadow-[var(--shadow-sm)]">Changes tomorrow</span>
      </div>

      {!ready ? (
        <div className="rounded-2xl border border-line bg-surface-raised px-5 py-8 text-center shadow-[var(--shadow-sm)]">
          <p className="text-body font-medium text-ink">Loading today&apos;s question…</p>
          {status === "error" ? (
            <p role="alert" className="mt-2 text-caption text-danger">
              We couldn&apos;t load your daily progress. Reload the page to try again.
            </p>
          ) : null}
        </div>
      ) : completed ? (
        <div role="status" aria-live="polite" className="flex items-start gap-4 rounded-2xl border border-positive/30 bg-positive/10 p-5 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-positive text-white shadow-[var(--shadow-sm)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2.5">
              <polyline points="5,13 10,18 19,7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-heading font-bold text-positive">Awesome job — you solved the Question of the Day.</p>
            <p className="mt-1 text-caption text-ink-muted">Come back tomorrow for a fresh question.</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl">
          <ChallengeCard
            challenge={question}
            selected={selected}
            submitted={submitted}
            wasCorrect={wasCorrect}
            onSelect={setSelected}
            onSubmit={submit}
            onNext={tryAgain}
            nextLabel={saving ? "Saving…" : wasCorrect && !saveFailed ? "Finishing…" : "Try again"}
            nextDisabled={saving || (wasCorrect === true && !saveFailed)}
          />
          {saveFailed ? (
            <p role="alert" className="mt-3 text-caption text-danger">
              Your answer could not be saved. Check your connection and try again.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
