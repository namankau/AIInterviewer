import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ReportView } from "@/components/report-view";

export const metadata: Metadata = { title: "Your report" };

/**
 * In the shell like every other page. It used to be a bare page with no way back except
 * reading to the bottom and finding "practise again" — so the only route out of a report
 * was through all of it, which is the opposite of how anybody reads one.
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell breadcrumb="report">
      <div className="w-full max-w-3xl">
        <ReportView sessionId={id} />
      </div>
    </AppShell>
  );
}
