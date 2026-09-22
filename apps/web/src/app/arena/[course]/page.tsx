import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArenaCoursePractice } from "@/components/arena/arena-course-practice";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { courses, getCourse } from "@/content/courses";
import { challengesForCourse } from "@/lib/arena/corpus";

export function generateStaticParams() {
  return courses.map((course) => ({ course: course.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string }>;
}): Promise<Metadata> {
  const { course: courseSlug } = await params;
  const course = getCourse(courseSlug);
  if (!course) return {};
  return {
    title: `${course.title} — Arena — AceMyInterview`,
    description: `Practise ${course.title} as short rounds derived from its own chapters — free, no account needed.`,
  };
}

/**
 * One course's Arena — its modules as campaigns, rising in difficulty in the same order
 * the course teaches them (task 055: "the courses already have a module structure — use
 * it. This is nearly free"). Every count is real, from the derived corpus. Statically
 * generated, like `/courses/[course]` — the only client-rendered piece is
 * `ArenaCoursePractice`, which reads an optional `?chapter=` query string.
 */
export default async function ArenaCoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: courseSlug } = await params;
  const course = getCourse(courseSlug);
  if (!course) notFound();

  const challenges = challengesForCourse(course.slug);
  const challengesByChapter = new Map<string, number>();
  for (const challenge of challenges) {
    challengesByChapter.set(challenge.chapterSlug, (challengesByChapter.get(challenge.chapterSlug) ?? 0) + 1);
  }
  const chapters = course.modules.flatMap((module) => module.chapters).map((c) => ({ slug: c.slug, title: c.title }));

  return (
    <div className="min-h-dvh">
      <CourseSiteHeader />
      <Breadcrumbs
        items={[{ label: "home", href: "/dashboard" }, { label: "arena", href: "/arena" }, { label: course.title.toLowerCase() }]}
      />
      <div className="border-b border-line px-6 py-3 md:px-12">
        <p className="mx-auto max-w-6xl font-mono text-micro tracking-widest text-ink-subtle lowercase">
          <Link href="/arena" className="hover:text-ink">
            arena
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-ink-muted">{course.slug}</span>
        </p>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <header className="flex flex-col gap-4">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{course.level}</p>
          <h1 className="text-display text-balance text-ink">{course.title}</h1>
          <p className="max-w-xl text-body text-ink-muted">{course.tagline}</p>
        </header>

        <div className="mt-8">
          <Suspense fallback={null}>
            <ArenaCoursePractice key={course.slug} courseSlug={course.slug} chapters={chapters} />
          </Suspense>
        </div>

        <section className="mt-14 flex flex-col gap-8">
          <h2 className="text-title text-ink">Campaigns</h2>
          {course.modules.map((module, moduleIndex) => (
            <div key={module.title} className="flex flex-col gap-3 rounded-md border border-line-strong bg-surface-raised px-6 py-5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-micro tracking-widest text-accent uppercase">
                  Campaign {moduleIndex + 1}
                </span>
                <h3 className="text-heading text-ink">{module.title}</h3>
              </div>
              <ul className="flex flex-wrap gap-2">
                {module.chapters.map((chapter) => {
                  const count = challengesByChapter.get(chapter.slug) ?? 0;
                  return (
                    <li key={chapter.slug}>
                      <Link
                        href={`/courses/${course.slug}/${chapter.slug}`}
                        className="rounded-full border border-line-strong px-3 py-1 text-caption text-ink-muted transition-colors hover:border-accent hover:text-ink"
                      >
                        {chapter.title}
                        {count > 0 ? <span className="ml-1.5 text-ink-subtle">· {count}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </main>
      <CourseSiteFooter />
    </div>
  );
}
