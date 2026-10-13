import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { LEGAL } from "@/lib/legal";

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
              U
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
