import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { courses, getCourse, totalChapters, totalMinutes } from "@/content/courses";

export function generateStaticParams() {
  return courses.map((course) => ({ course: course.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string }>;
}): Promise<Metadata> {
  const { course: slug } = await params;
  const course = getCourse(slug);
  if (!course) return {};
  return {
    title: `${course.title} — AceMyInterview`,
    description: course.tagline,
  };
}

/** A course's home page: hero band, module-by-module chapter list, start CTA. */
export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();

  const firstChapter = course.modules[0]?.chapters[0];

  return (
    <div className="min-h-dvh">
      <CourseSiteHeader />
      <section className="bg-grid border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 md:py-20">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            <Link href="/courses" className="hover:text-ink">
              Courses
            </Link>
            <span className="px-1.5">/</span>
            {course.title}
          </p>
          <h1 className="text-hero text-balance text-ink">{course.title}</h1>
          <p className="max-w-xl text-body text-ink-muted">{course.tagline}</p>
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            {course.level} · {totalChapters(course)} chapters · {totalMinutes(course)} min
          </p>
          {firstChapter ? (
            <Link
              href={`/courses/${course.slug}/${firstChapter.slug}`}
              className="w-fit rounded-md bg-accent px-5 py-2.5 text-caption font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
            >
              Start course
            </Link>
          ) : null}
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 py-14 md:py-20">
        <ol className="flex flex-col gap-10">
          {course.modules.map((module, mi) => (
            <li key={module.title}>
              <h2 className="text-heading text-ink">
                Module {mi + 1} — {module.title}
              </h2>
              <ol className="mt-4 flex flex-col divide-y divide-line border-y border-line">
                {module.chapters.map((chapter, ci) => (
                  <li key={chapter.slug}>
                    <Link
                      href={`/courses/${course.slug}/${chapter.slug}`}
                      className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-surface-sunken"
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="font-mono text-micro text-ink-subtle">
                          {String(mi + 1)}.{String(ci + 1)}
                        </span>
                        <span className="text-caption text-ink">{chapter.title}</span>
                      </span>
                      <span className="font-mono text-micro text-ink-subtle">{chapter.minutes} min</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </main>
      <CourseSiteFooter />
    </div>
  );
}
