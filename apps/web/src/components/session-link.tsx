"use client";

import type { Route } from "next";
import Link from "next/link";

import { useAccessToken } from "@/lib/use-access-token";

/** Keep public navigation accurate without making a static page wait for an auth request. */
export function SessionLink({
  signedIn,
  signedOut,
  className,
}: {
  signedIn: { href: Route; label: string };
  signedOut: { href: Route; label: string };
  className: string;
}) {
  const token = useAccessToken();

  // Wait for the browser's session check so "Sign in" never flashes for a signed-in user.
  if (token === undefined) return null;

  const destination = token ? signedIn : signedOut;
  return <Link href={destination.href} className={className}>{destination.label}</Link>;
}
