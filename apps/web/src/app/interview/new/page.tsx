import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { NewInterviewForm } from "@/components/new-interview-form";
import { ROUND_CATALOGUE } from "@/lib/rounds";

export const metadata: Metadata = { title: "Start an interview" };

/**
 * Session setup. Company and role are named here, per session — there is no stored
 * target list, and no setup step that asks the candidate to declare targets in
 * advance (PRD 05).
 */
export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[]; topic?: string | string[] }>;
}) {
  const { round: roundParam, topic: topicParam } = await searchParams;
  const topic = Array.isArray(topicParam) ? topicParam[0] : topicParam;
  const requestedRound = Array.isArray(roundParam) ? roundParam[0] : roundParam;
  const roundType = ROUND_CATALOGUE.find((round) => round.value === requestedRound)?.value;
  return (
    <AppShell breadcrumb="new interview">
      <div className="w-full max-w-2xl">
        <NewInterviewForm initialRoundType={roundType} initialTopic={topic} />
      </div>
    </AppShell>
  );
}
