import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { SiteNavLinks } from "@/components/site-nav-links";

/**
 * The top bar for the course and Arena pages.
 *
 * These pages sit behind sign-in (21 Sep 2026), so this is a signed-in bar: the same
 * destinations as the app's left rail, the current section marked, a way to start an
 * interview, and a way to sign out. It is a top bar rather than `AppShell`'s rail because
 * the chapter reader needs the full width for its own three columns (task 052).
 */
export function CourseSiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3 md:px-12">
        <Link href="/dashboard" className="text-heading font-bold tracking-tight text-ink">
          AceMyInterview
        </Link>
        <nav aria-label="Main" className="order-3 w-full md:order-none md:w-auto">
          <SiteNavLinks />
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/interview/new"
            className="rounded-lg bg-accent px-4 py-2 text-caption font-semibold text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong"
          >
            New interview
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

export function CourseSiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <span className="text-caption text-ink-subtle">AceMyInterview — practice interviews, not interview help.</span>
        <Link href="/interview/new" className="font-mono text-micro tracking-widest text-ink-subtle uppercase hover:text-ink">
          Ready to practise an interview?
        </Link>
      </div>
    </footer>
  );
}
