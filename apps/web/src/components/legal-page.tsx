import type { Route } from "next";
import Link from "next/link";

import { LEGAL } from "@/lib/legal";

/** The links every public page footer carries, so the legal pages are always one click away. */
export const LEGAL_LINKS: { href: Route; label: string }[] = [
  { href: "/privacy" as Route, label: "Privacy policy" },
  { href: "/terms" as Route, label: "Terms of use" },
  { href: "/contact" as Route, label: "Contact" },
];

/**
 * A plain, readable frame for the public legal pages. Not the signed-in app shell: these
 * have to be reachable by anybody, including Google's review of the sign-in screen.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-heading font-bold text-ink">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-micro font-extrabold text-accent-contrast">
              AI
            </span>
            {LEGAL.productName}
          </Link>
          <Link href="/login" className="text-caption font-medium text-accent hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-display text-balance text-ink">{title}</h1>
          <p className="text-body text-ink-muted">{intro}</p>
          <p className="text-caption text-ink-subtle">Last updated {LEGAL.lastUpdated}</p>
        </div>
        <div className="legal-prose flex flex-col gap-8 text-body leading-relaxed text-ink-muted">{children}</div>
      </main>

      <footer className="border-t border-line">
        <nav aria-label="Legal" className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-6 py-6">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-caption text-ink-muted hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </footer>
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
