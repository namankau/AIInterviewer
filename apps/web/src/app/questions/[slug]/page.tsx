import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CompanyQuestions } from "@/components/company-questions";
import { questionBankBrowsable } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Sourced questions",
  robots: { index: false, follow: false },
};

/** One company's sourced questions, filterable by round. Signed-in only; not found unless the bank is browsable. */
export default async function CompanyQuestionsPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!questionBankBrowsable()) notFound();
  const { slug } = await params;
  return (
    <AppShell breadcrumb="questions">
      <div className="w-full max-w-4xl">
        <CompanyQuestions slug={slug} />
      </div>
    </AppShell>
  );
}
