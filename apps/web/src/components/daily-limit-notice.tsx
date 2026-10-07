import type { EntitlementView } from "@acemyinterview/shared";

/** True when the refusal is the daily free allowance, which is what this notice is for. */
export function isDailyLimitReached(entitlement: EntitlementView | null | undefined): boolean {
  return (
    !!entitlement &&
    !entitlement.allowed &&
    (entitlement.reason === "daily_rounds_reached" || entitlement.reason === "daily_minutes_reached")
  );
}

/**
 * Shown in place of a start button once today's free practice is used.
 *
 * There is no paid tier yet, so this says Pro is coming rather than offering a checkout
 * that does not exist. The server's message carries the actual numbers, so the page never
 * states an allowance the API did not.
 */
export function DailyLimitNotice({ entitlement }: { entitlement: EntitlementView }) {
  return (
    <section
      aria-labelledby="daily-limit-heading"
      className="flex flex-col gap-3 rounded-2xl border border-highlight/40 bg-highlight/10 p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="daily-limit-heading" className="text-heading text-ink">
          Today&rsquo;s free practice is used
        </h2>
        <span className="pill w-fit rounded-full border border-accent/25 bg-accent-wash px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase">
          Pro · coming soon
        </span>
      </div>
      <p className="max-w-prose text-body text-ink-muted">{entitlement.message}</p>
      <p className="max-w-prose text-caption text-ink-subtle">
        Until then, the courses and the Arena are open with no daily limit.
      </p>
    </section>
  );
}
