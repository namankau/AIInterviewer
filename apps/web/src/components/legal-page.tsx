import Link from "next/link";

import { BrandWordmark } from "@/components/brand-logo";
import { SessionLink } from "@/components/session-link";
import { SiteFooter } from "@/components/site-footer";
import { LEGAL } from "@/lib/legal";

/**
 * A plain, readable frame for the public legal pages. Not the signed-in app shell: these
 * have to be reachable by anybody, including Google's review of the sign-in screen.
 */
export function LegalPage({
  title,
  intro,
  eyebrow = "Untiered · Legal",
  showUpdated = true,
  children,
}: {
  title: string;
  intro: string;
  eyebrow?: string;
  showUpdated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="inline-flex items-center focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label="Untiered home">
            <BrandWordmark />
          </Link>
          <SessionLink
            signedIn={{ href: "/dashboard", label: "Dashboard" }}
            signedOut={{ href: "/login", label: "Sign in" }}
            className="rounded-lg px-3 py-2 text-caption font-semibold text-accent transition-colors hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12 sm:py-16">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <span className="pill pill-accent w-fit">{eyebrow}</span>
          <h1 className="text-display text-balance text-ink">{title}</h1>
          <p className="text-body text-ink-muted">{intro}</p>
          {showUpdated ? <p className="text-caption text-ink-subtle">Last updated {LEGAL.lastUpdated}</p> : null}
        </div>
        <div className="legal-prose mx-auto flex w-full max-w-3xl flex-col gap-9 rounded-2xl border border-line bg-surface-raised p-6 text-body leading-relaxed text-ink-muted shadow-[var(--shadow-sm)] sm:p-10">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** One numbered-free section with a heading, so the page reads as a document. */
export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-title text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}
