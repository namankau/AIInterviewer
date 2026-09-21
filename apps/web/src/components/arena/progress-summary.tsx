"use client";

import { BADGES, levelForXp } from "@/lib/arena/progression";
import { useArenaProgress } from "@/lib/arena/progress-store";

/**
 * The learner's own progress — level, streak, badges earned — read from the account.
 *
 * Renders nothing until it has loaded: "Level 0, no streak" is a specific and wrong claim
 * to show a learner who has a streak going, and it would flash on every page load.
 */
export function ProgressSummary() {
  const { progress, ready } = useArenaProgress();
  const level = levelForXp(progress.xp);
  const percentIntoLevel = level.xpForNextLevel > 0 ? Math.round((level.xpIntoLevel / level.xpForNextLevel) * 100) : 100;
  const earnedBadges = BADGES.filter((b) => progress.badges.includes(b.id));

  if (!ready) return null;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line-strong bg-surface-raised px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-title text-ink">Level {level.level}</span>
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{progress.xp} XP total</span>
        </div>
        <p className="flex items-center gap-2 text-caption text-ink-muted">
          <StreakIcon />
          {progress.streak.current > 0
            ? `${progress.streak.current}-day streak`
            : "No active streak yet — play a run today to start one"}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={level.xpForNextLevel}
        aria-valuenow={level.xpIntoLevel}
        aria-label={`${level.xpIntoLevel} of ${level.xpForNextLevel} XP into level ${level.level + 1}`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${percentIntoLevel}%` }} />
      </div>

      {earnedBadges.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {earnedBadges.map((badge) => (
            <li
              key={badge.id}
              title={badge.description}
              className="rounded-full bg-highlight/15 px-3 py-1 text-micro font-medium text-ink"
            >
              {badge.title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StreakIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-current text-highlight">
      <path d="M8 1c1 3-3 4-3 7a3 3 0 0 0 6 0c0-1-.5-1.8-1-2.3.6 1.6-1 2.3-1 2.3-.6-2 .8-2.4 1-4C10.7 5 12 6.5 12 9a4 4 0 1 1-8 0C4 5 7 4 8 1z" />
    </svg>
  );
}
