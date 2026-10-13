import type { Route } from "next";
import Link from "next/link";

import { AccountSummary } from "@/components/account-summary";
import { RailNav } from "@/components/rail-nav";
import { SiteFooter } from "@/components/site-footer";

/**
 * The frame every signed-in page sits in.
 *
 * The Figma direction uses a horizontal learning-platform bar: brand at the left, stable
 * product destinations in the middle, and the signed-in person at the right. Keeping that
 * bar across the product makes the broad dashboard, catalogue and report canvases feel like
 * one place while leaving the content the full width it needs.
 *
 * Deliberately not applied to the interview room. That page is near-empty by design and
 * a navigation rail beside a live interview would be an invitation to leave it.
 */
export function AppShell({
  wide = false,
  children,
}: {
  /** Retained for route compatibility; page-level breadcrumb strips are intentionally hidden. */
  breadcrumb?: string;
  /** Retained for route compatibility while nested pages move navigation into their own content. */
  parent?: { label: string; href: Route };
  /** Gives document-like tools (such as the chapter reader) room for their own local navigation. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-surface-raised/95 shadow-[var(--shadow-sm)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-x-5 px-4 sm:flex-nowrap sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="group flex shrink-0 items-center gap-2.5 py-3.5 text-heading font-bold tracking-tight text-ink"
          >
            <span className="grid size-9 place-items-center rounded-[0.7rem] bg-accent text-caption font-extrabold text-accent-contrast shadow-[0_8px_22px_rgba(70,84,220,0.25)] transition-transform group-hover:-rotate-3">
              U
            </span>
            <span className="hidden sm:inline">Untiered</span>
          </Link>

          <nav aria-label="Main" className="nav-scroll order-3 w-full min-w-0 overflow-x-auto border-t border-line sm:order-none sm:w-auto sm:flex-1 sm:border-t-0">
            <RailNav />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
            <Link
              href={"/upgrade" as Route}
              className="inline-flex rounded-lg bg-accent-wash px-3 py-2 text-caption font-semibold text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              Upgrade
            </Link>
            <AccountSummary />
          </div>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,var(--surface-tint)_0,transparent_24rem)]">
        {/*
          * Wide enough to compose in, capped so a line of prose never runs the width of a
          * monitor. The page used to be a 768px column pinned to the left of whatever
          * screen it was on, with the entire right-hand side empty — not restraint, just
          * an unused canvas.
          */}
        <main
          className={`mx-auto w-full flex-1 px-6 py-10 md:px-12 md:py-14 ${
            wide ? "max-w-[100rem]" : "max-w-[78rem]"
          }`}
        >
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
