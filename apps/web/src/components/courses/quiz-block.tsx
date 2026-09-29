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
    <div className="rounded-md border border-line-strong bg-surface-raised px-5 py-4">
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Check yourself</p>
      <fieldset className="mt-2">
        <legend className="text-heading text-ink">{block.question}</legend>
        <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-labelledby={groupId}>
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
                  "rounded-md border px-3.5 py-2.5 text-left text-body leading-relaxed transition-colors",
                  !revealed
                    ? "border-line text-ink hover:border-line-strong hover:bg-surface-sunken"
                    : isCorrect
                      ? "border-positive/50 bg-positive/10 text-ink"
                      : isChosen
                        ? "border-danger/50 bg-danger/10 text-ink"
                        : "border-line text-ink-subtle",
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>
      {revealed ? (
        <p role="status" className="mt-3 text-body leading-relaxed text-ink">
          <span className={selected === block.answer ? "font-medium text-positive" : "font-medium text-danger"}>
            {selected === block.answer ? "Correct. " : "Not quite. "}
          </span>
          {block.why}
        </p>
      ) : null}
    </div>
  );
}
