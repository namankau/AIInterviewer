import type { Route } from "next";
import Link from "next/link";

export interface Crumb {
  label: string;
  /** Omit on the page you are on. */
  href?: string;
}

/**
 * Where you are and the way back: a "back" link to the parent page, then the full trail.
 * The parent is always an explicit route rather than `history.back()`, so it goes where the
 * label says even when someone arrived from a search result or a shared link.
 */
export function Breadcrumbs({ items, wide = false }: { items: Crumb[]; wide?: boolean }) {
  const parent = [...items].reverse().find((item) => item.href);

  return (
    <div className={`mx-auto px-6 pt-5 ${wide ? "max-w-[100rem] md:px-12" : "max-w-6xl"}`}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {parent?.href ? (
          <Link
            href={parent.href as Route}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent-wash px-3 text-caption font-semibold text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast"
          >
            <span aria-hidden="true">←</span>
            Back to {parent.label}
          </Link>
        ) : null}
        <ol className="flex flex-wrap items-center gap-1.5 font-mono text-micro tracking-widest text-ink-subtle lowercase">
          {items.map((item, i) => (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden="true" className="text-line-strong">/</span> : null}
              {item.href ? (
                <Link href={item.href as Route} className="hover:text-ink">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink-muted">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
