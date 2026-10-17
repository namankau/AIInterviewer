import Link from "next/link";

import { BrandWordmark } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteNavLinks } from "@/components/site-nav-links";
import { ActionLink } from "@/components/ui/action-link";
import { SiteFooter } from "@/components/site-footer";
import { featureEnabled } from "@/lib/flags";

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
      <div className="mx-auto flex layout-reader flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3 md:px-12">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          aria-label="Untiered dashboard"
        >
          <BrandWordmark />
        </Link>
        <nav aria-label="Main" className="order-3 flex min-w-0 w-full items-center gap-2 md:order-none md:w-auto">
          <div className="min-w-0 flex-1 overflow-x-auto md:overflow-visible">
            <SiteNavLinks />
          </div>
          <div className="shrink-0 md:hidden">
            <SignOutButton />
          </div>
        </nav>
        <div className="flex items-center gap-2">
          {featureEnabled("mockInterviews") ? (
            <ActionLink href="/interview/new" size="sm">
              New interview
            </ActionLink>
          ) : null}
          <div className="hidden md:block">
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}

export function CourseSiteFooter() {
  return <SiteFooter />;
}
