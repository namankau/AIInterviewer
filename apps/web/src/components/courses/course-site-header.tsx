import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { SiteNavLinks } from "@/components/site-nav-links";
import { ActionLink } from "@/components/ui/action-link";

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
    <header className="sticky top-0 z-40 border-b border-line bg-surface-raised/90 shadow-[var(--shadow-sm)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3 md:px-12">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2.5 text-heading font-bold tracking-tight text-ink"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-micro font-extrabold text-accent-contrast shadow-[var(--shadow-sm)] transition-transform group-hover:-rotate-3">
            AI
          </span>
          <span>AceMyInterview</span>
        </Link>
        <nav aria-label="Main" className="order-3 w-full md:order-none md:w-auto">
          <SiteNavLinks />
        </nav>
        <div className="flex items-center gap-2">
          <ActionLink href="/interview/new" size="sm">
            New interview
          </ActionLink>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

export function CourseSiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy text-on-navy">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-9">
        <span className="text-caption text-on-navy-muted">
          AceMyInterview — practice interviews, not interview help.
        </span>
        <Link
          href="/interview/new"
          className="font-mono text-micro tracking-widest text-on-navy-muted uppercase transition-colors hover:text-on-navy"
        >
          Ready to practise an interview?
        </Link>
      </div>
    </footer>
  );
}
