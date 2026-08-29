import type { Metadata } from "next";

import { SignInWithGoogle } from "@/components/sign-in-with-google";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-24">
      <div className="flex flex-col gap-3">
        <p className="text-caption tracking-wide text-ink-subtle uppercase">AceMyInterview</p>
        <h1 className="text-title text-ink">Sign in</h1>
        <p className="text-body text-ink-muted">
          Google is the only way in for now. No password to remember on the morning of an interview.
        </p>
      </div>

      <SignInWithGoogle next={safeNext(next)} />
    </main>
  );
}
