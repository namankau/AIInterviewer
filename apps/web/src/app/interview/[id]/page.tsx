import type { Metadata } from "next";

import { InterviewRoom } from "@/components/interview-room";

export const metadata: Metadata = { title: "Interview in progress" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InterviewRoom sessionId={id} />;
}
