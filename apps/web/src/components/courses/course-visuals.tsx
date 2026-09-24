const coursePresentation = {
  java: {
    shortLabel: "Java",
    outcome: "Write clean, object-oriented Java from scratch",
    practice: "Runnable programs and coding drills",
    accent: "border-warning/25 bg-warning-wash text-warning",
    line: "bg-warning",
    motif: "code",
  },
  dsa: {
    shortLabel: "DSA",
    outcome: "Recognise patterns and reason through coding rounds",
    practice: "Pattern drills and interview problems",
    accent: "border-positive/25 bg-positive-wash text-positive",
    line: "bg-positive",
    motif: "nodes",
  },
  "ai-agents": {
    shortLabel: "AI",
    outcome: "Understand models and assemble reliable agents",
    practice: "Prompt, tool and agent experiments",
    accent: "border-accent/25 bg-accent-wash text-accent-strong",
    line: "bg-accent",
    motif: "spark",
  },
} as const;

export function getCoursePresentation(courseSlug: string) {
  return coursePresentation[courseSlug as keyof typeof coursePresentation] ?? coursePresentation.java;
}

export function CourseMotif({ courseSlug, large = false }: { courseSlug: string; large?: boolean }) {
  const presentation = getCoursePresentation(courseSlug);
  const size = large ? "size-24" : "size-14";

  return (
    <div
      aria-hidden="true"
      className={`grid ${size} shrink-0 place-items-center rounded-2xl border ${presentation.accent}`}
    >
      {presentation.motif === "code" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <path d="m18 14-9 10 9 10M30 14l9 10-9 10M27 9l-6 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {presentation.motif === "nodes" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <path d="M13 13h22M13 13l11 22m11-22L24 35" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="13" cy="13" r="5" fill="currentColor" /><circle cx="35" cy="13" r="5" fill="currentColor" /><circle cx="24" cy="35" r="5" fill="currentColor" />
        </svg>
      ) : null}
      {presentation.motif === "spark" ? (
        <svg viewBox="0 0 48 48" className={large ? "size-14" : "size-8"} fill="none">
          <path d="M24 6c1.8 10.3 7.7 16.2 18 18-10.3 1.8-16.2 7.7-18 18-1.8-10.3-7.7-16.2-18-18C16.3 22.2 22.2 16.3 24 6Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M38 5v8M34 9h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : null}
    </div>
  );
}

export function CourseAccentLine({ courseSlug }: { courseSlug: string }) {
  return <span aria-hidden="true" className={`block h-1.5 w-12 rounded-full ${getCoursePresentation(courseSlug).line}`} />;
}
