import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArenaDailyQuest } from "@/components/arena/arena-daily-quest";
import { AppShell } from "@/components/app-shell";
import { courses } from "@/content/courses";
import { allArenaChallenges } from "@/lib/arena/corpus";
import { dailyCourseQuests, possibleDateKeysWorldwide } from "@/lib/arena/progression";
import { courseEnabled } from "@/lib/flags";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = {
  title: "Arena — Untiered",
  description:
    "Short, sharp practice rounds derived from every chapter of every course — spot the mistake, predict " +
    "the output, say what happens next. Included free in the signed-in learning workspace.",
};

/**
 * The signed-in Arena landing page. Daily sets are selected server-side from the real
 * corpus; account progress is the only part that needs the browser.
 */
export default function ArenaPage() {
  requireFeature("arena");
  const visibleCourses = courses.filter((course) => courseEnabled(course.slug));
  if (visibleCourses.length === 0) notFound();
  // Computed here, against the full corpus, server-side — only the resulting handful of
  // challenges (at most 3 dates * number of courses * 3 questions) crosses into the client (task 056, L3).
  const questsByDate = Object.fromEntries(
    possibleDateKeysWorldwide().map((dateKey) => [
      dateKey,
      dailyCourseQuests(
        allArenaChallenges,
        visibleCourses.map(({ slug, title }) => ({ slug, title })),
        dateKey,
      ),
    ]),
  );

  return (
    <AppShell breadcrumb="arena">
      <ArenaDailyQuest questsByDate={questsByDate} />
    </AppShell>
  );
}
