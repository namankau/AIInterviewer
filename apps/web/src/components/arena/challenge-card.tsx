"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";

import { ArenaVizFrame } from "@/components/arena/arena-viz-frame";
import type { Challenge } from "@/lib/arena/types";

const KIND_LABEL: Record<Challenge["kind"], string> = {
  mcq: "Quiz",
  "predict-output": "Predict the output",
  "spot-mistake": "Spot the mistake",
  "which-column": "Which one?",
  "what-next": "What happens next?",
};

/**
 * One challenge, full width, one at a time (task 055, §1). Keyboard-first by design, not
 * as an add-on: digits 1-4 select an option, Enter confirms the selection or — once
 * feedback is showing — advances. This is also the accessibility requirement, not a
 * power-user nicety, so there is no mouse-only path through a session.
 */
export function ChallengeCard({
  challenge,
  selected,
  submitted,
  wasCorrect,
  onSelect,
  onSubmit,
  onNext,
}: {
  challenge: Challenge;
  selected: number | null;
  submitted: boolean;
  wasCorrect: boolean | null;
  onSelect: (index: number) => void;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new challenge's heading whenever it changes, so a screen-reader
  // user and a keyboard user both land somewhere sensible instead of on a stale element.
  useEffect(() => {
    headingRef.current?.focus();
  }, [challenge.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (submitted) onNext();
        else if (selected !== null) onSubmit();
        return;
      }
      if (!submitted) {
        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= challenge.options.length) {
          event.preventDefault();
          onSelect(digit - 1);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, selected, challenge.options.length, onSelect, onSubmit, onNext]);

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="rounded-full bg-accent-wash px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase">
          {KIND_LABEL[challenge.kind]}
        </span>
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{challenge.moduleTitle}</span>
      </div>

      {challenge.kind === "what-next" && challenge.viz && challenge.frameIndex !== undefined ? (
        <div className="flex justify-center rounded-xl border border-line bg-surface-sunken px-3 py-5">
          <ArenaVizFrame viz={challenge.viz} frameIndex={challenge.frameIndex} />
        </div>
      ) : null}

      {challenge.kind === "predict-output" && challenge.code ? (
        <pre className="overflow-x-auto rounded-xl border border-line-strong bg-surface-sunken px-4 py-3 font-mono text-caption text-ink">
          <code>{challenge.code}</code>
        </pre>
      ) : null}

      <h2 ref={headingRef} tabIndex={-1} className="text-title text-balance text-ink outline-none whitespace-pre-line">
        {challenge.prompt}
      </h2>

      <ul className="flex flex-col gap-2.5" role="list">
        {challenge.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrectOption = submitted && i === challenge.correctIndex;
          const isWrongPick = submitted && isSelected && i !== challenge.correctIndex;
          return (
            <li key={option}>
              <button
                type="button"
                disabled={submitted}
                aria-pressed={isSelected}
                onClick={() => onSelect(i)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border bg-surface-raised px-4 py-3 text-left text-body shadow-[var(--shadow-sm)] transition-[border-color,background-color,transform]",
                  isCorrectOption
                    ? "border-positive/50 bg-positive/10 text-ink"
                    : isWrongPick
                      ? "border-danger/50 bg-danger/10 text-ink"
                      : isSelected
                        ? "border-accent bg-accent-wash text-ink"
                        : "border-line text-ink hover:-translate-y-0.5 hover:border-accent disabled:hover:translate-y-0 disabled:hover:border-line",
                ].join(" ")}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-micro">
                  {i + 1}
                </span>
                <span className="flex-1">{option}</span>
                {isCorrectOption ? <StatusIcon kind="correct" /> : null}
                {isWrongPick ? <StatusIcon kind="incorrect" /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {!submitted ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={selected === null}
          className="self-start rounded-xl bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm (Enter)
        </button>
      ) : (
        <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken px-5 py-4">
          <p className={`flex items-center gap-2 text-body font-semibold ${wasCorrect ? "text-positive" : "text-danger"}`}>
            {wasCorrect ? <StatusIcon kind="correct" /> : <StatusIcon kind="incorrect" />}
            {wasCorrect ? "Correct" : "Not quite"}
          </p>
          <p className="text-caption leading-relaxed text-ink-muted">{challenge.why}</p>
          <div className="flex items-center gap-3">
            <Link
              href={`/courses/${challenge.courseSlug}/${challenge.chapterSlug}` as Route}
              className="text-caption font-medium text-accent hover:underline"
            >
              Revisit this chapter
            </Link>
            <button
              type="button"
              onClick={onNext}
              className="ml-auto rounded-xl bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong"
            >
              Next (Enter)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Correct/incorrect is always paired with an icon and this text, never colour alone. */
function StatusIcon({ kind }: { kind: "correct" | "incorrect" }) {
  if (kind === "correct") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-2">
        <polyline points="3,9 7,13 13,4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-2">
      <line x1="4" y1="4" x2="12" y2="12" strokeLinecap="round" />
      <line x1="12" y1="4" x2="4" y2="12" strokeLinecap="round" />
    </svg>
  );
}
