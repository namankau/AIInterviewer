import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { NewInterviewForm } from "@/components/new-interview-form";

export const metadata: Metadata = { title: "Start an interview" };

/**
 * Session setup. Company and role are named here, per session — there is no stored
 * target list, and no setup step that asks the candidate to declare targets in
 * advance (PRD 05).
 */
export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const { topic: topicParam } = await searchParams;
  const topic = Array.isArray(topicParam) ? topicParam[0] : topicParam;
  return (
    <AppShell breadcrumb="new interview">
      <div className="w-full max-w-2xl">
        <NewInterviewForm initialTopic={topic} />
      </div>
    </AppShell>
  );
}
