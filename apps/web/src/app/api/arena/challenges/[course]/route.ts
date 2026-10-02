import { NextResponse } from "next/server";

import { challengesForCourse } from "@/lib/arena/corpus";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * One course's derived Arena challenges, fetched on demand (task 056, L3).
 *
 * `/arena/[course]` picks its practice set from the learner's own review schedule
 * (`pickSessionChallenges`, client-side, against `progress.cards`) — unlike the daily
 * quest, that selection genuinely depends on account state the server doesn't have, so it
 * can't be narrowed to a handful of dates the way `dailyQuest` was. Serving the course's
 * challenges from a route handler instead of a server-component prop keeps them out of the
 * page's static HTML and RSC payload; the client component fetches them itself, once, after
 * it mounts.
 *
 * Signed-in only, like the Arena page itself (owner decision, 21 September 2026). The
 * proxy's redirect guards pages, not this route, so the check is made here: the session
 * cookie travels with the same-origin fetch, and `getClaims` verifies it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ course: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) {
    return NextResponse.json({ error: "Sign in to practise in the Arena." }, { status: 401 });
  }

  const { course } = await params;
  const challenges = challengesForCourse(course);
  return NextResponse.json(challenges);
}
