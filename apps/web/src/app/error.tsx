"use client";

import { ErrorPanel } from "@/components/errors/error-panel";

/** Any page that throws while rendering lands here rather than on Next's default page. */
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      title="This page didn't load"
      body="Something failed on our side while putting this page together. Trying again usually works."
      onRetry={reset}
    />
  );
}
