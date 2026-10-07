import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry-options";

/** Server and edge errors, initialised once per runtime by Next. */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions);
  }
}

/** Errors thrown while rendering on the server (server components, route handlers). */
export const onRequestError = Sentry.captureRequestError;
