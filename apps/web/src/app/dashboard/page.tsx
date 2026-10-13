import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ContinueLearning } from "@/components/continue-learning";
import { DashboardPanel } from "@/components/dashboard-panel";
import { DashboardQuestionOfDay } from "@/components/dashboard-question-of-day";
import { dashboardQuestionPool } from "@/lib/arena/corpus";
import { possibleDateKeysWorldwide, questionOfTheDay } from "@/lib/arena/progression";
import { getCourseOutlines } from "@/lib/course-outline";
import { courseEnabled, featureEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Home" };

// The daily question map covers every local date that exists worldwide at request time.
// Rendering per request keeps it current after midnight without shipping the full Arena
// corpus to the browser or depending on a daily deployment.
export const dynamic = "force-dynamic";

/**
 * The dashboard keeps the next interview as its primary action, then offers one bounded
 * daily recall question below it. Company and role are named at the point of starting a
 * session — there is no target list to configure, by design (PRD 05).
 */
export default function DashboardPage() {
  const arenaEnabled = featureEnabled("arena");
  const eligibleChallenges = arenaEnabled
    ? dashboardQuestionPool.filter((challenge) => courseEnabled(challenge.courseSlug))
    : [];
  const questionsByDate = Object.fromEntries(
    possibleDateKeysWorldwide().flatMap((dateKey) => {
      const question = questionOfTheDay(eligibleChallenges, dateKey);
      return question ? [[dateKey, question] as const] : [];
    }),
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <DashboardPanel />
        {arenaEnabled ? <DashboardQuestionOfDay questionsByDate={questionsByDate} /> : null}
        <ContinueLearning outlines={getCourseOutlines()} />
      </div>
    </AppShell>
  );
}
