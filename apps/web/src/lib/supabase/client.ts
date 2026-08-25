import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/** Supabase client for browser code. Safe to call on every render — it is memoised upstream. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
