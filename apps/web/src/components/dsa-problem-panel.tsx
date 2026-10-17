import type { CodingProblem } from "@untiered/shared";

/** The coding question stays visible beside the interviewer while the editor fills the right pane. */
export function DsaProblemPanel({ problem }: { problem: CodingProblem }) {
  return (
    <section aria-label="Coding problem" className="border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="eyebrow text-accent">Problem</p>
          <h2 className="mt-2 text-heading font-semibold text-ink">{problem.title}</h2>
        </div>
        <span className="pill pill-highlight">{problem.difficulty}</span>
      </div>
      <p className="mt-4 font-mono text-micro tracking-widest text-ink-subtle uppercase">{problem.topic}</p>

      <Section title="Problem">
        <p className="whitespace-pre-wrap text-body text-ink-muted">{problem.statement}</p>
      </Section>

      {problem.examples.length > 0 && (
        <Section title="Examples">
          <div className="space-y-3">
            {problem.examples.map((example, index) => (
              <div key={index} className="rounded-lg bg-surface-sunken p-3">
                <p className="text-caption font-medium text-ink">Example {index + 1}</p>
                <Field label="Input" value={example.input} />
                <Field label="Output" value={example.output} />
                {example.explanation && (
                  <p className="mt-2 text-caption leading-relaxed text-ink-muted">{example.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {problem.constraints.length > 0 && (
        <Section title="Constraints">
          <ul className="space-y-1">
            {problem.constraints.map((constraint) => (
              <li key={constraint} className="font-mono text-caption text-ink-muted">
                · {constraint}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 font-mono text-micro tracking-widest text-ink-subtle uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{label}</p>
      <pre className="mt-0.5 overflow-x-auto font-mono text-caption text-ink">{value}</pre>
    </div>
  );
}
