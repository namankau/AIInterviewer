import { AppShell } from "@/components/app-shell";

/**
 * What a signed-in page shows the instant its link is pressed.
 *
 * Every page behind sign-in renders on demand, and Next only prefetches a dynamic route
 * when it has a `loading.tsx` to prefetch. Without one, a click on the top navigation did
 * nothing visible until the server had finished the whole page — which read as the link
 * not working. The shell and this skeleton are prefetched with the link, so the bar stays
 * put and the page body fills in when it arrives.
 */
export function RouteLoading() {
  return (
    <AppShell>
      <div role="status" aria-live="polite" className="flex flex-col gap-6">
        <span className="sr-only">Loading…</span>
        <div aria-hidden className="h-4 w-28 animate-pulse rounded-full bg-accent-wash" />
        <div aria-hidden className="h-9 w-full max-w-md animate-pulse rounded-xl bg-surface-sunken" />
        <div aria-hidden className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl border border-line bg-surface-raised" />
          ))}
        </div>
        <div aria-hidden className="h-64 animate-pulse rounded-3xl border border-line bg-surface-raised" />
      </div>
    </AppShell>
  );
}
