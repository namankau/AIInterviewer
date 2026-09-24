"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { questionBankBrowsable } from "@/lib/flags";
import { NAV_LINKS } from "@/lib/nav-links";

/**
 * The rail's links, with the page you are on marked.
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
    <ul className="flex flex-wrap gap-1.5 md:flex-col" aria-label="Workspace">
      {NAV_LINKS.filter((link) => link.href !== "/questions" || questionBankBrowsable()).map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            <Link
              href={link.href as Route}
              aria-current={active ? "page" : undefined}
              className={`block rounded-xl px-3 py-2.5 text-caption transition-colors ${
                active
                  ? "bg-white/14 font-semibold text-on-navy shadow-[inset_3px_0_0_var(--accent)]"
                  : "text-on-navy-muted hover:bg-white/8 hover:text-on-navy"
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

