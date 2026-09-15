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
    <main className="flex min-h-dvh items-center justify-center bg-surface-sunken px-6 py-24">
      <div className="card flex w-full max-w-md flex-col gap-10 p-10">
        <div className="flex flex-col gap-3">
          <p className="text-caption font-semibold tracking-wide text-accent uppercase">
            AceMyInterview
          </p>
          <h1 className="text-title font-bold text-ink">Sign in</h1>
          <p className="text-body text-ink-muted">
            Google is the only way in for now. No password to remember on the morning of an
            interview.
          </p>
        </div>

        <SignInWithGoogle next={safeNext(next)} />
      </div>
    </main>
  );
}
