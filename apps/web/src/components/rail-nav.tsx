"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { questionBankBrowsable } from "@/lib/flags";

/**
 * The rail's links, with the page you are on marked.
 *
 * Three identical grey words with no current-page state is not navigation, it is a list;
 * you cannot tell where you are, and every page therefore looks like the same page. The
 * marker is a rule down the left edge rather than a filled pill — the rest of the
 * interface is set in rules and ink, and a pill would be the only rounded solid on screen.
 */
export function RailNav() {
  const pathname = usePathname();

  return (
    <ul className="flex flex-wrap gap-x-1 gap-y-0.5 md:flex-col">
      {LINKS.filter((link) => link.href !== "/questions" || questionBankBrowsable()).map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`-ml-px block border-l py-1.5 pl-3 text-caption transition-colors ${
                active
                  ? "border-accent font-medium text-ink"
                  : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Typed routes are on, so these are literals rather than a widened string[]. */
const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/rounds", label: "Rounds" },
  { href: "/questions", label: "Questions" },
  { href: "/courses", label: "Courses" },
  { href: "/profile", label: "Profile" },
] as const;
