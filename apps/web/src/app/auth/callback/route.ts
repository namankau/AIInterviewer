import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes the PKCE exchange Google redirects back into, then sends the candidate on.
 * The session lands in cookies here; the API still verifies the token independently.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (searchParams.get("error")) {
    // Supabase reports provider failures on the query string, e.g. a cancelled consent screen.
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
