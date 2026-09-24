"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { questionBankBrowsable } from "@/lib/flags";
import { NAV_LINKS } from "@/lib/nav-links";

/** The top bar's links, with the current section marked (`aria-current`, not colour alone). */
export function SiteNavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-sunken p-1">
      {NAV_LINKS.filter((link) => link.href !== "/questions" || questionBankBrowsable()).map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <li key={link.href}>
            <Link
              href={link.href as Route}
              aria-current={active ? "page" : undefined}
              className={`block rounded-lg px-3 py-1.5 text-caption transition-all ${
                active
                  ? "bg-surface-raised font-semibold text-accent-strong shadow-[var(--shadow-sm)]"
                  : "text-ink-muted hover:bg-surface-raised/70 hover:text-ink"
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
