import type { Metadata } from "next";

import { AccountSummary } from "@/components/account-summary";
import { AppShell } from "@/components/app-shell";
import { DashboardPanel } from "@/components/dashboard-panel";

export const metadata: Metadata = { title: "Home" };

/**
 * The dashboard's job is to start the next interview, so there is exactly one primary
 * action here and nothing competing with it. Company and role are named at the point of
 * starting a session — there is no target list to configure, by design (PRD 05).
 */
export default function DashboardPage() {
  return (
    <AppShell>
      <div className="flex max-w-3xl flex-col gap-14">
        <DashboardPanel />
        <AccountSummary />
      </div>
    </AppShell>
  );
}
