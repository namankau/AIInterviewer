"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

type BeatKey = "see" | "predict" | "interact" | "explain" | "check";

export type GuidedBeat = {
  key: BeatKey;
  label: string;
  shortLabel: string;
  description: string;
  cardCount: number;
  content: ReactNode;
};

function BeatIcon({ beat }: { beat: BeatKey }) {
  const paths: Record<BeatKey, ReactNode> = {
    see: <><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /></>,
    predict: <><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-2.9 2-2.9 4" /><path d="M12 18h.01" /><circle cx="12" cy="12" r="10" /></>,
    interact: <path d="m8 5 11 7-11 7V5Z" />,
    explain: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.5 15.2 14 16 14 17h-4c0-1-.5-1.8-1.5-2.5Z" /></>,
    check: <><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">{paths[beat]}</svg>;
}

/** A deliberately small client island: state and controls only; lesson blocks stay server-rendered. */
export function GuidedLessonControls({ beats }: { beats: GuidedBeat[] }) {
  const [activeBeat, setActiveBeat] = useState(0);
  const lessonId = useId();

  return (
    <section aria-labelledby={`${lessonId}-title`} className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-sm">
      <div className="border-b border-line bg-accent-wash px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-micro tracking-widest text-accent uppercase">Guided lesson</p>
            <h2 id={`${lessonId}-title`} className="mt-1 text-title text-ink">Learn it in five short beats</h2>
            <p className="mt-1 max-w-[65ch] text-caption leading-relaxed text-ink-muted">Read a little, make a choice, then use the interactive examples to test the idea.</p>
          </div>
          <p className="rounded-full border border-accent/25 bg-surface-raised px-3 py-1 font-mono text-micro text-accent" aria-live="polite">Beat {activeBeat + 1} of {beats.length}</p>
        </div>

        <nav aria-label="Learning beats" className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2">
          {beats.map((beat, index) => (
            <button key={beat.key} type="button" aria-label={beat.label} aria-current={activeBeat === index ? "step" : undefined} aria-controls={`${lessonId}-${beat.key}`} onClick={() => setActiveBeat(index)} className={["group flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-left text-caption font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:justify-start sm:px-3", activeBeat === index ? "border-accent/40 bg-accent text-white" : "border-line bg-surface-raised text-ink-muted hover:border-accent/40 hover:text-ink"].join(" ")}>
              <span className="shrink-0"><BeatIcon beat={beat.key} /></span>
              <span className="hidden min-w-0 sm:block"><span className="block truncate">{beat.shortLabel}</span></span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-3 sm:p-5">
        {beats.map((beat, index) => (
          <details key={beat.key} id={`${lessonId}-${beat.key}`} data-testid={`lesson-beat-${beat.key}`} open={activeBeat === index} className="group mb-2 rounded-lg border border-line bg-surface last:mb-0 open:border-line-strong open:shadow-sm">
            <summary onClick={(event) => { event.preventDefault(); setActiveBeat(index); }} className="flex cursor-pointer list-none items-start gap-3 rounded-lg px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-accent-wash text-accent"><BeatIcon beat={beat.key} /></span>
              <span className="min-w-0 flex-1"><span className="block text-heading text-ink">{beat.label}</span><span className="mt-0.5 block text-caption leading-relaxed text-ink-muted">{beat.description}</span></span>
              <span aria-hidden="true" className="mt-1 text-ink-subtle transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="border-t border-line px-4 py-5 sm:px-6 sm:py-7">
              {beat.content ?? <p className="max-w-[65ch] rounded-md border border-dashed border-line-strong bg-surface-sunken px-4 py-3 text-caption leading-relaxed text-ink-muted">This chapter does not need a separate activity for this beat. Continue when you are ready.</p>}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="font-mono text-micro text-ink-subtle">{beat.cardCount} learning {beat.cardCount === 1 ? "card" : "cards"}</p>
                {index < beats.length - 1 ? <button type="button" onClick={() => setActiveBeat(index + 1)} className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-caption font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Continue to {beats[index + 1]!.shortLabel}</button> : null}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
