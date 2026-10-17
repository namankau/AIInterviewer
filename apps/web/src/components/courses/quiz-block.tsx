"use client";

import { useId, useState } from "react";

import type { Block } from "@/content/courses/types";

type Quiz = Extract<Block, { kind: "quiz" }>;

/**
 * One quiz question. Picking an option reveals whether it was right, and always reveals
 * `why` — the point is to test understanding, not to score the reader (PRD design brief,
 * 15 Sep 2026: "quiz reveals the answer on interaction").
 */
export function QuizBlock({ block }: { block: Quiz }) {
  const [selected, setSelected] = useState<number | null>(null);
  const groupId = useId();
  const revealed = selected !== null;

  return (
    <div className="overflow-hidden rounded-surface border border-line bg-surface-raised shadow-[var(--shadow-sm)]">
      <div className="border-b border-accent/15 bg-[linear-gradient(115deg,var(--accent-wash),var(--surface-raised))] px-5 py-5 sm:px-7 sm:py-6">
        <p className="inline-flex items-center gap-2 text-micro font-bold tracking-widest text-accent-strong uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          Check yourself
        </p>
        <h3 id={groupId} className="mt-3 max-w-[52ch] text-title font-semibold leading-snug text-ink">
          {block.question}
        </h3>
      </div>
      <fieldset className="px-5 py-5 sm:px-7 sm:py-6">
        <legend className="sr-only">Answer options</legend>
        <div className="grid gap-2.5" role="radiogroup" aria-labelledby={groupId}>
          {block.options.map((option, i) => {
            const isCorrect = i === block.answer;
            const isChosen = i === selected;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={revealed}
                onClick={() => setSelected(i)}
                className={[
                  "group flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-body leading-relaxed text-ink transition-[border-color,background-color,box-shadow,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  !revealed
                    ? "border-line bg-surface-raised hover:-translate-y-px hover:border-accent/45 hover:bg-accent-wash/40 hover:shadow-[var(--shadow-sm)]"
                    : isCorrect
                      ? "border-positive/50 bg-positive-wash"
                      : isChosen
                        ? "border-danger/50 bg-danger-wash"
                        : "border-line bg-surface-sunken text-ink-subtle",
                ].join(" ")}
              >
                <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-lg text-caption font-bold ${isChosen && revealed ? isCorrect ? "bg-positive text-positive-contrast" : "bg-danger text-danger-contrast" : "bg-surface-sunken text-ink-muted group-hover:bg-surface-raised"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
                {revealed && isCorrect ? <span aria-hidden="true" className="text-positive">✓</span> : null}
              </button>
            );
          })}
        </div>
        {revealed ? (
        <p role="status" className="mt-4 rounded-xl border border-line bg-surface-sunken px-4 py-3 text-body leading-relaxed text-ink">
          <span className={selected === block.answer ? "font-medium text-positive" : "font-medium text-danger"}>
            {selected === block.answer ? "Correct. " : "Not quite. "}
          </span>
          {block.why}
        </p>
      ) : null}
      </fieldset>
    </div>
  );
}
