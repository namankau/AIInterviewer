import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

/**
 * Routes that require a signed-in candidate. Everything except the landing page and the
 * sign-in flow: courses and the Arena were public until the owner decided (21 Sep 2026)
 * that a visitor should sign up or in before seeing any of it.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/questions",
  "/courses",
  "/arena",
  "/interview",
  "/rounds",
  "/profile",
  "/report",
];

/** Matches the prefix itself or anything beneath it — `/arena` but not `/arenas`. */
function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Routes a signed-in candidate has no reason to see. */
const SIGNED_OUT_ONLY = ["/login"];

/**
 * Refreshes the Supabase session on every request and enforces the route guard.
 *
 * The guard here is a redirect, not a security boundary — it keeps signed-out people
 * off pages that would only fail for them. Authorisation is enforced by the API,
 * which verifies the token itself on every call.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser revalidates the token with Supabase; getSession would only read the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (user && SIGNED_OUT_ONLY.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
