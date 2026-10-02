import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * What a candidate sees when a page fails to render, instead of the framework's bare
 * error page: what happened in plain words, one way to try again, one way out.
 *
 * Nothing technical is shown. The error's message can carry internals, and a candidate
 * in the middle of an interview needs a next step, not a stack trace.
 */
export function ErrorPanel({
  title,
  body,
  onRetry,
  retryLabel = "Try again",
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col justify-center gap-5 px-6 py-16">
      <p className="pill pill-highlight w-fit">Something went wrong</p>
      <h1 className="text-title text-balance text-ink">{title}</h1>
      <p className="text-body text-ink-muted">{body}</p>
      <div className="flex flex-wrap items-center gap-4">
        {onRetry ? <Button onClick={onRetry}>{retryLabel}</Button> : null}
        <Link href="/dashboard" className="text-body text-accent underline-offset-4 hover:underline">
          Go to your dashboard
        </Link>
      </div>
    </main>
  );
}
