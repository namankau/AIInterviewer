import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type AlertTone = "info" | "success" | "warning" | "error";

const toneStyles: Record<AlertTone, string> = {
  info: "border-info/25 bg-info-wash text-info",
  success: "border-positive/25 bg-positive-wash text-positive",
  warning: "border-warning/25 bg-warning-wash text-warning",
  error: "border-danger/25 bg-danger-wash text-danger",
};

export function Alert({
  tone = "info",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border p-4 text-caption", toneStyles[tone], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <h2 className="text-heading text-ink">{title}</h2>
      {description ? <p className="max-w-prose text-caption text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-surface-sunken", className)} {...props} />;
}
