import type { Metadata } from "next";

import { ReportView } from "@/components/report-view";

export const metadata: Metadata = { title: "Your report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <ReportView sessionId={id} />
    </div>
  );
}
