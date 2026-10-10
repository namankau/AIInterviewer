"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { questionBankBrowsable } from "@/lib/flags";
import { NAV_LINKS } from "@/lib/nav-links";

/**
 * The signed-in product navigation, with the page you are on marked.
 *
 * Three identical grey words with no current-page state is not navigation, it is a list;
 * you cannot tell where you are, and every page therefore looks like the same page. The
 * marker is now a filled pill on the current page — the wider revamp (task 044) put pill
 * shapes to work elsewhere (badges, tags), so a pill here reads as the same visual
 * language rather than as one rounded solid on an otherwise square screen.
 */
export function RailNav() {
  const pathname = usePathname();

  return (
    <ul className="flex min-w-max items-stretch gap-1" aria-label="Workspace">
      {NAV_LINKS.filter((link) => link.href !== "/questions" || questionBankBrowsable()).map((link) => {
        const active =
          pathname === link.href ||
          pathname.startsWith(`${link.href}/`) ||
          (link.href === "/history" && pathname.startsWith("/report/"));
        return (
          <li key={link.href}>
            <Link
              href={link.href as Route}
              aria-current={active ? "page" : undefined}
              className={`relative block h-full px-3 py-5 text-caption transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full ${
                active
                  ? "font-semibold text-ink after:bg-accent"
                  : "text-ink-muted after:bg-transparent hover:text-ink"
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

