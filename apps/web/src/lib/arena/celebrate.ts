import confetti from "canvas-confetti";

/**
 * The one place `canvas-confetti` is called from (task 055). `disableForReducedMotion` is
 * the library's own option, but it defaults to **off** — so every call site here checks
 * `prefers-reduced-motion` itself and skips the animation entirely rather than relying on
 * a flag it would be easy to forget to pass.
 *
 * Fire this on a genuine milestone only (a new badge, levelling up, finishing a daily
 * quest) — never on every correct answer, which would turn a celebration into noise.
 */
export function celebrate(prefersReducedMotion: boolean): void {
  if (prefersReducedMotion) return;
  void confetti({
    particleCount: 90,
    spread: 70,
    origin: { y: 0.6 },
    disableForReducedMotion: true,
  });
}
