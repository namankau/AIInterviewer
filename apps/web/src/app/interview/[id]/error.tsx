"use client";

import { ErrorPanel } from "@/components/errors/error-panel";

/**
 * A render failure mid-round. The round lives on the server, so the way back in is to
 * render the page again, not to start over; the copy says so rather than implying the
 * interview is lost.
 */
export default function InterviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      title="The interview screen stopped"
      body="Something failed on our side while showing your round. Your round is kept on our side, and rejoining usually brings you straight back into it."
      onRetry={reset}
      retryLabel="Rejoin the round"
    />
  );
}
