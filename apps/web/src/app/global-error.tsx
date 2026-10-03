"use client";

import "./globals.css";

import { ErrorPanel } from "@/components/errors/error-panel";

/**
 * The last resort, for a failure in the root layout itself. It replaces the whole
 * document, so it brings its own `<html>` and `<body>`.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <ErrorPanel
          title="AceMyInterview didn't load"
          body="Something failed on our side before the page could start. Trying again usually works."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
