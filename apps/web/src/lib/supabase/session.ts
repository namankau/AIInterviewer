import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { questionBankBrowsable } from "@/lib/flags";

/**
 * Routes that require a signed-in candidate. `/questions` only while the bank is browsable:
 * hidden, it answers 404 to everyone, and a sign-in redirect would say the page exists.
 */
function protectedPrefixes(): string[] {
  return questionBankBrowsable() ? ["/dashboard", "/questions"] : ["/dashboard"];
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

  if (!user && protectedPrefixes().some((prefix) => pathname.startsWith(prefix))) {
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
