import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <main role="status" aria-label="Loading page" className="layout-content mx-auto flex min-h-dvh w-full flex-col gap-6 px-4 py-10 sm:px-6">
      <span className="sr-only">Loading page…</span>
      <Skeleton className="h-11 w-40" />
      <Skeleton className="h-12 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </main>
  );
}
