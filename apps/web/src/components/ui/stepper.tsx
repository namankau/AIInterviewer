export function Stepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap gap-3" aria-label="Progress steps">
      {steps.map((step, index) => (
        <li key={`${step}-${index}`} aria-current={index === current ? "step" : undefined} className="flex items-center gap-2 text-caption text-ink-muted">
          <span className={`grid size-8 place-items-center rounded-full border font-semibold ${index <= current ? "border-accent bg-accent text-accent-contrast" : "border-line-strong bg-surface-raised text-ink-muted"}`}>{index + 1}</span>
          <span className={index === current ? "font-semibold text-ink" : undefined}>{step}</span>
        </li>
      ))}
    </ol>
  );
}
