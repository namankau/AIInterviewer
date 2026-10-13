"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * The current Supabase access token, or null once we know there isn't one.
 * `undefined` means we are still finding out — screens use that to avoid flashing
 * a signed-out state at someone who is signed in.
 */
let cachedToken: string | null | undefined;

export function useAccessToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(() => cachedToken);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      const next = data.session?.access_token ?? null;
      cachedToken = next;
      if (active) setToken(next);
    });

    // Tokens refresh roughly hourly; an interview can outlast one.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.access_token ?? null;
      cachedToken = next;
      if (active) setToken(next);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return token;
}
