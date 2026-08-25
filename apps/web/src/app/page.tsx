import Link from "next/link";

/**
 * Public landing placeholder.
 *
 * Landing content is a later task. It stays server-rendered because organic search on
 * "<employer> interview" queries is a primary acquisition channel (PRD 11).
 */
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-5">
        <p className="text-caption tracking-wide text-ink-subtle uppercase">InterviewOS</p>
        <h1 className="text-display text-balance text-ink">
          Mock interviews that sound like the real thing.
        </h1>
        <p className="max-w-prose text-body text-ink-muted">
          Pick the company and the role. Take a spoken interview conducted the way that employer
          actually runs one. Get a report that cites what you said.
        </p>
      </div>

      <div>
        <Link
          href="/login"
          className="inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
