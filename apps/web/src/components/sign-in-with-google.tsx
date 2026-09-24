"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignInWithGoogleProps {
  /** Path to land on after the exchange completes. */
  next: string;
}

export function SignInWithGoogle({ next }: SignInWithGoogleProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (signInError) {
      setPending(false);
      setError("Google sign-in could not be started. Please try again.");
    }
    // On success the browser navigates to Google, so there is nothing to reset.
  }

  return (
    <div className="flex flex-col gap-3">
      <Button className="w-full" onClick={signIn} disabled={pending} aria-busy={pending}>
        {pending ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
