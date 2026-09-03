import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";

/**
 * The frame every signed-in page sits in.
 *
 * A rail rather than a top bar, because the pages behind it are lists and documents —
 * a report, a history, a catalogue — and a persistent left edge is what makes a set of
 * pages read as one tool instead of as a series of screens. It is also where a candidate
 * looks for the thing they came to do, which is why "New interview" sits at the top of
 * it and nothing competes with it.
 *
 * Deliberately not applied to the interview room. That page is near-empty by design and
 * a navigation rail beside a live interview would be an invitation to leave it.
 */
export function AppShell({
  breadcrumb,
  children,
}: {
  breadcrumb?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <nav
        aria-label="Main"
        className="flex shrink-0 flex-col gap-8 border-b border-line px-5 py-5 md:w-60 md:border-r md:border-b-0 md:py-8"
      >
        <Link href="/dashboard" className="text-heading tracking-tight text-ink">
          AceMyInterview
        </Link>

        <Link
          href="/interview/new"
          className="rounded-md bg-accent px-4 py-2.5 text-center text-caption font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          New interview
        </Link>

        <ul className="flex flex-wrap gap-x-5 gap-y-1 md:flex-col">
          <RailLink href="/dashboard" label="Home" />
          <RailLink href="/rounds" label="Rounds" />
        </ul>

        <div className="md:mt-auto">
          <SignOutButton />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {breadcrumb ? (
          <div className="border-b border-line px-6 py-3 md:px-10">
            <p className="font-mono text-micro tracking-widest text-ink-subtle lowercase">
              <Link href="/dashboard" className="hover:text-ink">
                home
              </Link>
              <span className="px-1.5">/</span>
              <span className="text-ink-muted">{breadcrumb}</span>
            </p>
          </div>
        ) : null}
        <main className="flex-1 px-6 py-10 md:px-10 md:py-14">{children}</main>
      </div>
    </div>
  );
}

/** Typed routes are on, so the href is taken from Link itself rather than widened to string. */
function RailLink({ href, label }: { href: React.ComponentProps<typeof Link>["href"]; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="text-caption text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        {label}
      </Link>
    </li>
  );
}
