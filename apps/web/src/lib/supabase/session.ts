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

  // `getClaims` verifies the access token's signature locally against the project's JWKS,
  // which it caches, instead of asking the auth server who this is. `getUser` was here
  // before and cost a network round trip to Supabase on *every* request through this proxy
  // — and because the matcher covers ordinary navigations, that includes every RSC prefetch
  // Next fires for a link entering the viewport. The courses index alone has 65 of those.
  //
  // This is not a weakening: `getSession` would be, because it only decodes the cookie and
  // trusts it. `getClaims` checks the signature and the expiry, and refreshes the session
  // first if the token is about to lapse. What it does not do is ask whether the account was
  // deleted or banned in the last few minutes — which does not matter here, because the
  // guard below is a redirect and not a security boundary. The API verifies the token itself
  // on every call and is the only thing standing between a request and somebody's data.
  //
  // One caveat for whoever reads this next: the round trip only actually goes away if the
  // Supabase project signs its JWTs with asymmetric keys. On a project still using the
  // legacy shared secret, `getClaims` has no key to verify against and falls back to asking
  // the server, exactly as `getUser` did. Same behaviour, no gain. Switching a project to
  // asymmetric signing keys is a dashboard action.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims.sub ? { id: claims.claims.sub } : null;

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
