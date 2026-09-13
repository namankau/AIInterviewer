"use client";

import type { TurnView } from "@acemyinterview/shared";
import { useEffect, useRef, useState } from "react";

/**
 * Counts down to the server's deadline, not to a clock of its own — a drifting tab or a
 * sleeping laptop must not buy the candidate extra time. Says so once when it reaches
 * zero; what that means for the round is the room's to decide.
 */
export function RoundClock({
  endsAt,
  phase,
  onExpired,
}: {
  endsAt: string | null;
  phase?: TurnView["phase"];
  onExpired?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  // Read through a ref: a new callback every render must not restart the countdown.
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  });

  useEffect(() => {
    if (!endsAt) return;
    const deadline = new Date(endsAt).getTime();
    let announced = false;
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !announced) {
        announced = true;
        expired.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (remaining === null) return null;

  return (
    <span className="flex items-baseline gap-2">
      {phase ? (
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {phase === "warmup" ? "Warm-up" : phase === "closing" ? "Closing" : "Main round"}
        </span>
      ) : null}
      <span
        className="font-mono text-caption text-ink-muted tabular-nums"
        aria-label={`${spokenDuration(remaining)} left in this round`}
      >
        {formatDuration(remaining)}
      </span>
    </span>
  );
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The time left as a screen reader should say it. Rounded down, as the interviewer's own
 * mention of it is: rounding up said "5 minutes left" to a candidate with 4:01.
 */
function spokenDuration(seconds: number): string {
  const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return count(rest, "second");
  return rest ? `${count(minutes, "minute")} ${count(rest, "second")}` : count(minutes, "minute");
}
