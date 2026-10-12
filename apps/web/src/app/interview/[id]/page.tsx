import type { Metadata } from "next";

import { InterviewRoom } from "@/components/interview-room";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Interview in progress" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  requireFeature("mockInterviews");
  const { id } = await params;
  return <InterviewRoom sessionId={id} />;
}
