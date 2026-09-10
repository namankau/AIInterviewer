"use client";

import type { BoardState, DesignCase } from "@acemyinterview/shared";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import "@excalidraw/excalidraw/index.css";

/**
 * Excalidraw reaches for `window` while its module is evaluating, so it cannot be part of
 * the server bundle at all. Next's dynamic import with `ssr: false` is the supported way
 * to say that.
 */
const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((module) => module.Excalidraw), {
  ssr: false,
  loading: () => <CanvasPlaceholder>Getting the board ready…</CanvasPlaceholder>,
});

/** The shape of a system design round, and the order an interviewer walks it in. */
export const DESIGN_PHASES = ["Requirements", "High-level", "Deep dive", "Wrap"] as const;
export type DesignPhase = (typeof DESIGN_PHASES)[number];

/**
 * Which phase a round of [durationMinutes] is in after [minutesElapsed].
 *
 * Advisory, and only advisory. The rail tells the candidate roughly where they should be
 * so they can pace themselves — the same thing a real interviewer does by glancing at the
 * clock and saying "let's move on". It does not gate anything, because a candidate still
 * arguing about requirements at the half hour is telling the interviewer something
 * useful, and a UI that locked the board would destroy that signal rather than record it.
 */
export function phaseAt(minutesElapsed: number, durationMinutes: number): DesignPhase {
  if (durationMinutes <= 0) return "Requirements";
  const through = minutesElapsed / durationMinutes;
  if (through < 0.25) return "Requirements";
  if (through < 0.55) return "High-level";
  if (through < 0.85) return "Deep dive";
  return "Wrap";
}

/**
 * The system design round's workspace: the case on the left, a board in the middle.
 *
 * The candidate draws. The interviewer does not — not yet. A board that fills itself in
 * as somebody talks is the most striking thing in the reference, and it is also the thing
 * most likely to draw the wrong box at the wrong moment and derail a round; it wants its
 * own build and its own latency budget rather than being smuggled in here.
 */
export function DesignWorkspace({
  designCase,
  board,
  minutesElapsed,
  durationMinutes,
  onBoardChange,
}: {
  designCase: DesignCase;
  board: BoardState | null;
  minutesElapsed: number;
  durationMinutes: number;
  onBoardChange: (board: BoardState) => void;
}) {
  const phase = phaseAt(minutesElapsed, durationMinutes);

  /*
   * Excalidraw is uncontrolled: it takes its opening scene once and owns it after that.
   * Passing a changing `initialData` would reset the board under the candidate's hand
   * every time the room re-rendered — which it does on every timer tick.
   *
   * State with a lazy initialiser rather than a ref, because a ref read during render is
   * exactly what the React compiler refuses, and "computed once and then never again" is
   * what this actually means.
   */
  const [initialData] = useState(() => ({
    elements: (board?.elements ?? []) as never[],
    scrollToContent: true,
  }));

  const save = useCallback(
    (elements: readonly unknown[]) => {
      onBoardChange({ kind: "system_design", elements: [...elements] });
    },
    [onBoardChange],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-px bg-line lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto bg-surface-raised p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-ink-subtle">The case</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-ink">{designCase.title}</h2>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {designCase.constraints.map((constraint) => (
            <span
              key={constraint}
              className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs text-ink-muted"
            >
              {constraint}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">{designCase.summary}</p>

        <PhaseRail current={phase} />

        <p className="mt-6 text-xs leading-relaxed text-ink-subtle">
          The board is yours. Nothing on it is scored on neatness — it is here so you can point at
          something while you think.
        </p>
      </aside>

      <div className="min-h-0 bg-surface-raised">
        <Excalidraw
          initialData={initialData}
          onChange={save}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false } }}
        />
      </div>
    </div>
  );
}

function PhaseRail({ current }: { current: DesignPhase }) {
  const items = useMemo(() => DESIGN_PHASES, []);
  return (
    <nav className="mt-6" aria-label="Round shape">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-ink-subtle">Time</p>
      <ol className="space-y-1">
        {items.map((phase) => {
          const active = phase === current;
          return (
            <li key={phase}>
              <div
                aria-current={active ? "step" : undefined}
                className={`rounded-md px-2.5 py-1.5 text-sm transition ${
                  active ? "bg-surface-sunken font-medium text-ink" : "text-ink-subtle"
                }`}
              >
                {phase}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CanvasPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-surface-raised">
      <p className="text-sm text-ink-subtle">{children}</p>
    </div>
  );
}
