import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`; the behaviour is
 * unchanged. See https://nextjs.org/docs/messages/middleware-to-proxy.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files. updateSession exits immediately
     * for public content and refreshes cookies on guarded routes and /login.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
