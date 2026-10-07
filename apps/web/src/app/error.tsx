"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { ErrorPanel } from "@/components/errors/error-panel";

/** Any page that throws while rendering lands here rather than on Next's default page. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorPanel
      title="This page didn't load"
      body="Something failed on our side while putting this page together. Trying again usually works."
      onRetry={reset}
    />
  );
}
