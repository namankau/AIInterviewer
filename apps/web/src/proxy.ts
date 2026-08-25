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
     * Every path except static assets and image files. The session cookie has to be
     * refreshed on ordinary navigations, not just on guarded routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
