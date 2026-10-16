"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Toast({
  children,
  onDismiss,
  tone = "info",
}: {
  children: ReactNode;
  onDismiss: () => void;
  tone?: "info" | "success" | "error";
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("z-toast fixed right-4 bottom-4 flex max-w-sm items-center gap-4 rounded-lg border border-line bg-surface-raised px-4 py-3 text-caption text-ink shadow-[var(--shadow-lg)]", tone === "error" && "border-danger/30", tone === "success" && "border-positive/30")}>
      <div>{children}</div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="grid size-11 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink">×</button>
    </div>
  );
}
