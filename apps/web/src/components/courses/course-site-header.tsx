import Link from "next/link";

/**
 * The header for every /courses page. Deliberately not `AppShell` — courses are public,
 * reachable with no sign-in (PRD design brief, 15 Sep 2026), and AppShell's rail assumes a
 * signed-in candidate (an account summary that calls the API, a "New interview" CTA). A
 * signed-out visitor landing on a course page from search should see a page that stands on
 * its own, matching the marketing landing page's own header rather than a broken account
 * widget.
 */
export function CourseSiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-heading font-semibold tracking-tight text-ink">AceMyInterview</span>
          <span className="hidden font-mono text-micro tracking-widest text-ink-subtle uppercase sm:inline">
            courses
          </span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/courses" className="text-caption text-ink-muted transition-colors hover:text-ink">
            All courses
          </Link>
          <Link href="/arena" className="text-caption text-ink-muted transition-colors hover:text-ink">
            Arena
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-line-strong px-4 py-2 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function CourseSiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <span className="text-caption text-ink-subtle">AceMyInterview — practice interviews, not interview help.</span>
        <Link href="/" className="font-mono text-micro tracking-widest text-ink-subtle uppercase hover:text-ink">
          Ready to practise an interview?
        </Link>
      </div>
    </footer>
  );
}
