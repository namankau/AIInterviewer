import type { Metadata } from "next";
import Link from "next/link";

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
    <main className="grid min-h-dvh bg-surface lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-navy px-12 py-10 text-on-navy lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-14">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-28 size-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-accent-2/10 blur-3xl"
        />

        <Link href="/" className="relative flex w-fit items-center gap-2.5 text-heading font-bold tracking-tight text-on-navy">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-micro font-extrabold text-accent-contrast shadow-[0_8px_24px_rgba(26,100,240,0.32)]">
            AI
          </span>
          <span>AceMyInterview</span>
        </Link>

        <div className="relative max-w-xl">
          <span className="pill pill-navy mb-6">Your practice room</span>
          <h1 className="text-display text-balance text-on-navy">
            Walk into the real interview having already faced the hard questions.
          </h1>
          <p className="mt-5 max-w-lg text-body text-on-navy-muted">
            Speak your answers, handle follow-ups, and leave with evidence-backed feedback you can
            act on before the next round.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Voice-first practice"],
              ["02", "Employer-aware rounds"],
              ["03", "Evidence in every report"],
            ].map(([number, label]) => (
              <li key={number} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <span className="font-mono text-micro text-on-navy-muted">{number}</span>
                <span className="mt-2 block text-caption font-semibold text-on-navy">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative max-w-lg text-caption text-on-navy-muted">
          Your camera stays in your browser. Voice recordings and reports stay private to your
          account and can be deleted by you.
        </p>
      </section>

      <section className="flex items-center justify-center bg-surface-tint px-6 py-16 sm:px-10">
        <div className="flex w-full max-w-md flex-col gap-9 rounded-[1.5rem] border border-line bg-surface-raised p-7 shadow-[var(--shadow-lg)] sm:p-10 lg:shadow-[var(--shadow-md)]">
          <Link href="/" className="flex w-fit items-center gap-2.5 text-heading font-bold tracking-tight text-ink lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-micro font-extrabold text-accent-contrast">
              AI
            </span>
            <span>AceMyInterview</span>
          </Link>
          <div className="flex flex-col gap-3">
            <span className="pill pill-accent w-fit">Continue your preparation</span>
            <h2 className="text-title font-bold text-ink">Sign in to your practice room</h2>
            <p className="text-body text-ink-muted">
              Google is the only way in for now. No password to remember on the morning of an
              interview.
            </p>
          </div>

          <SignInWithGoogle next={safeNext(next)} />

          <p className="border-t border-line pt-5 text-caption text-ink-subtle">
            Courses, the Arena, mock interviews, and your reports are included while we build.
          </p>
        </div>
      </section>
    </main>
  );
}
