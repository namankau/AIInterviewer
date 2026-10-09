import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export interface PublicCourseCompletion {
  title: string;
  courseHref: `/courses/${string}`;
  completedAt: string;
  completedAtLabel: string;
  completedChapterCount: number;
  visibleChapters: string[];
}

export interface PublicTopicPractice {
  topic: string;
  explanationHref: `/courses/${string}`;
  completedAt: string;
  completedAtLabel: string;
  completedSessionCount: number;
}

export interface PublicProgressProfile {
  displayName: string;
  updatedAt: string;
  updatedAtLabel: string;
  courses: PublicCourseCompletion[];
  practiceTopics: PublicTopicPractice[];
}

export const SYNTHETIC_PROGRESS_PROFILE: PublicProgressProfile = {
  displayName: "Ananya Sharma",
  updatedAt: "2026-09-28",
  updatedAtLabel: "28 September 2026",
  courses: [
    {
      title: "Java Programming",
      courseHref: "/courses/java",
      completedAt: "2026-09-12",
      completedAtLabel: "12 September 2026",
      completedChapterCount: 16,
      visibleChapters: ["Java foundations", "Object-oriented programming", "Collections"],
    },
    {
      title: "Data Structures & Algorithms",
      courseHref: "/courses/dsa",
      completedAt: "2026-09-24",
      completedAtLabel: "24 September 2026",
      completedChapterCount: 12,
      visibleChapters: ["Complexity", "Arrays", "Trees and graphs"],
    },
  ],
  practiceTopics: [
    {
      topic: "Java collections",
      explanationHref: "/courses/java",
      completedAt: "2026-09-18",
      completedAtLabel: "18 September 2026",
      completedSessionCount: 2,
    },
    {
      topic: "Data structures and algorithms",
      explanationHref: "/courses/dsa",
      completedAt: "2026-09-27",
      completedAtLabel: "27 September 2026",
      completedSessionCount: 1,
    },
  ],
};

const privateItems = [
  "Scores, rankings, and private feedback",
  "Answers, transcripts, and recordings",
  "Resume details and employer targets",
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
      <p className="text-title font-extrabold text-on-navy">{value}</p>
      <p className="mt-1 text-caption leading-relaxed text-on-navy-muted">{label}</p>
    </div>
  );
}

function CompletionMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-positive-wash text-positive",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 12 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ProgressPagePrototype({
  profile = SYNTHETIC_PROGRESS_PROFILE,
}: {
  profile?: PublicProgressProfile;
}) {
  const chapterCount = profile.courses.reduce(
    (total, course) => total + course.completedChapterCount,
    0,
  );
  const practiceCount = profile.practiceTopics.reduce(
    (total, topic) => total + topic.completedSessionCount,
    0,
  );

  return (
    <main className="min-h-screen bg-surface text-ink">
      <section aria-labelledby="progress-title" className="overflow-hidden bg-navy">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
          <div className="max-w-3xl">
            <Badge tone="positive" className="bg-positive-wash text-positive">
              Synthetic preview
            </Badge>
            <p className="mt-6 font-mono text-micro font-bold tracking-widest text-accent-on-navy uppercase">
              Proof of progress
            </p>
            <h1
              id="progress-title"
              className="mt-3 text-display font-extrabold text-on-navy"
            >
              {profile.displayName}
            </h1>
            <p className="mt-4 max-w-2xl text-body leading-relaxed text-on-navy-muted">
              Learning and interview practice completed on InterviewOS.
            </p>
            <p className="mt-4 text-caption text-on-navy-muted">
              Last updated <time dateTime={profile.updatedAt}>{profile.updatedAtLabel}</time>
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            <Stat label="courses completed" value={profile.courses.length} />
            <Stat label="chapters completed" value={chapterCount} />
            <Stat label="topic interviews completed" value={practiceCount} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
        <Card className="border-accent/20 bg-accent-wash p-6 shadow-none sm:p-7">
          <div className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-heading font-black text-accent-contrast"
            >
              i
            </span>
            <div>
              <h2 className="text-heading font-extrabold text-ink">Completion, explained plainly</h2>
              <p className="mt-2 max-w-4xl leading-7 text-ink-muted">
                This page records activities completed on InterviewOS. It is not a certification,
                a claim of skill mastery, or an employer endorsement.
              </p>
            </div>
          </div>
        </Card>

        <section aria-labelledby="course-work-title">
          <div className="max-w-2xl">
            <p className="font-mono text-micro font-bold tracking-widest text-accent uppercase">Learning</p>
            <h2 id="course-work-title" className="mt-2 text-title font-extrabold">
              Course work
            </h2>
            <p className="mt-3 leading-7 text-ink-muted">
              Completed learning paths selected by the learner for this page.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {profile.courses.map((course) => (
              <Card key={course.title} className="flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <CompletionMark />
                  <div>
                    <Badge tone="positive">Completed</Badge>
                    <h3 className="mt-3 text-heading font-extrabold">{course.title}</h3>
                  </div>
                </div>
                <p className="mt-5 text-caption text-ink-muted">
                  {course.completedChapterCount} chapters completed ·{" "}
                  <time dateTime={course.completedAt}>{course.completedAtLabel}</time>
                </p>
                <ul className="mt-5 space-y-2 text-caption text-ink-muted" aria-label="Visible chapter groups">
                  {course.visibleChapters.map((chapter) => (
                    <li key={chapter} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 size-1.5 rounded-full bg-accent" />
                      <span>{chapter}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={course.courseHref}
                  className="mt-6 inline-flex w-fit items-center gap-2 font-bold text-accent underline-offset-4 hover:underline"
                >
                  What the {course.title} course covers
                  <span aria-hidden="true">→</span>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="practice-title">
          <div className="max-w-2xl">
            <p className="font-mono text-micro font-bold tracking-widest text-accent uppercase">Practice</p>
            <h2 id="practice-title" className="mt-2 text-title font-extrabold">
              Interview practice
            </h2>
            <p className="mt-3 leading-7 text-ink-muted">
              Topics counted only after a custom-topic interview was completed.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {profile.practiceTopics.map((practice) => (
              <Card key={practice.topic} className="p-6">
                <div className="flex items-start gap-4">
                  <CompletionMark className="bg-accent-wash text-accent" />
                  <div>
                    <h3 className="text-heading font-extrabold">{practice.topic}</h3>
                    <p className="mt-2 text-caption leading-relaxed text-ink-muted">
                      {practice.completedSessionCount}{" "}
                      {practice.completedSessionCount === 1 ? "session" : "sessions"} completed ·{" "}
                      <time dateTime={practice.completedAt}>{practice.completedAtLabel}</time>
                    </p>
                    <Link
                      href={practice.explanationHref}
                      className="mt-4 inline-flex w-fit items-center gap-2 font-bold text-accent underline-offset-4 hover:underline"
                    >
                      See what this topic covers
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="privacy-title" className="rounded-3xl bg-surface-sunken p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <Badge tone="navy">Privacy boundary</Badge>
              <h2 id="privacy-title" className="mt-4 text-title font-extrabold">
                Evidence without private interview content
              </h2>
              <p className="mt-3 leading-7 text-ink-muted">
                The learner chooses which qualifying completions appear. Completing a new activity
                does not add it to this page automatically.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5 shadow-none">
                <h3 className="font-extrabold text-positive">This page shows</h3>
                <ul className="mt-4 space-y-3 text-caption leading-relaxed text-ink-muted">
                  <li>Selected course and chapter completions</li>
                  <li>Selected topics practised in completed interviews</li>
                  <li>Completion dates and first-party explanations</li>
                </ul>
              </Card>
              <Card className="p-5 shadow-none">
                <h3 className="font-extrabold">What stays private</h3>
                <ul className="mt-4 space-y-3 text-caption leading-relaxed text-ink-muted">
                  {privateItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        <footer className="border-t border-line pt-7 text-caption leading-relaxed text-ink-muted">
          InterviewOS recorded the listed completion events. This page does not certify expertise or
          represent an employer endorsement.
        </footer>
      </div>
    </main>
  );
}
