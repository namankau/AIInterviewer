/**
 * Shared Sentry settings for the browser, the Node server and the edge runtime.
 *
 * Off until `NEXT_PUBLIC_SENTRY_DSN` is set, so local runs, tests and CI send nothing.
 *
 * Privacy, deliberately strict: this product handles recordings of people's voices and
 * their resumes. No session replay (it would record the screen), no default PII, and no
 * request bodies or cookies. A user is never named; the API tags its own events by
 * account id.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: SENTRY_DSN !== "",
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  beforeSend<T extends { request?: { cookies?: unknown; data?: unknown; headers?: Record<string, string> } }>(
    event: T,
  ): T {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      if (event.request.headers) delete event.request.headers.authorization;
    }
    return event;
  },
};
