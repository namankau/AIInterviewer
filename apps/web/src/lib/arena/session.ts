import { cyrb53, mulberry32, shuffle } from "@/lib/arena/hash";
import { isDue, type ReviewState } from "@/lib/arena/scheduler";
import type { Challenge } from "@/lib/arena/types";

/**
 * Picks the challenges for one Arena run (task 055, §1 — "around 7 challenges, 3-5
 * minutes, a clear end"). Due reviews come first, because a card FSRS says is due is the
 * one thing in the whole corpus we know the learner is at risk of forgetting right now;
 * the rest of the run is filled with challenges never seen before, so a brand-new learner
 * with an empty `cards` map still gets a full, varied session.
 *
 * `now` and `randomSeed` make this deterministic and testable — pass a fixed seed in
 * tests, and in the app pass something like the session's own start time so two runs in
 * the same minute don't look identical.
 */
export const SESSION_SIZE = 7;

export function pickSessionChallenges(
  allChallenges: Challenge[],
  cards: Record<string, ReviewState>,
  now: Date,
  randomSeed: string,
  size: number = SESSION_SIZE,
  courseSlug?: string,
): Challenge[] {
  const pool = courseSlug ? allChallenges.filter((c) => c.courseSlug === courseSlug) : allChallenges;
  if (pool.length === 0) return [];

  const due = pool
    .filter((c) => cards[c.id] && isDue(cards[c.id], now))
    .sort((a, b) => new Date(cards[a.id]!.due).getTime() - new Date(cards[b.id]!.due).getTime());

  const unseen = pool.filter((c) => !cards[c.id]);
  const rng = mulberry32(cyrb53(randomSeed) >>> 0);
  const shuffledUnseen = shuffle(unseen, rng);

  const chosen: Challenge[] = [];
  const usedIds = new Set<string>();
  for (const challenge of [...due, ...shuffledUnseen]) {
    if (chosen.length >= size) break;
    if (usedIds.has(challenge.id)) continue;
    usedIds.add(challenge.id);
    chosen.push(challenge);
  }

  // Pool smaller than `size`, and everything already seen and not due (e.g. a tiny
  // single-course pool): top up with whatever real challenges remain, still no repeats.
  if (chosen.length < size) {
    const shuffledRest = shuffle(
      pool.filter((c) => !usedIds.has(c.id)),
      rng,
    );
    for (const challenge of shuffledRest) {
      if (chosen.length >= size) break;
      chosen.push(challenge);
    }
  }

  return chosen;
}
