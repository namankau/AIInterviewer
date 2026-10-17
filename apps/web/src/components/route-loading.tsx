import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/feedback";

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
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-9 w-full max-w-md" />
        <div aria-hidden className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-36 border border-line" />
          ))}
        </div>
        <Skeleton className="h-64 border border-line" />
      </div>
    </AppShell>
  );
}
