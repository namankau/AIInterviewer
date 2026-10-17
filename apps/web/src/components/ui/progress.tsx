import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
}) {
  const bounded = Math.max(0, Math.min(max, value));
  const percentage = max > 0 ? (bounded / max) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={bounded}
      className={cn("h-2 overflow-hidden rounded-full bg-surface-sunken", className)}
    >
      <div className="h-full rounded-full bg-positive transition-[width] duration-200" style={{ width: `${percentage}%` }} />
    </div>
  );
}
