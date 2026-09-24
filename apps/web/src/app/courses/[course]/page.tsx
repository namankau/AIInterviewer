import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChapterDoneMark, CourseHeroProgress, ModuleProgress } from "@/components/courses/course-progress";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { courses, getCourse, totalChapters, totalMinutes } from "@/content/courses";
import { InlineText } from "@/components/courses/inline-text";

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

  return (
    <div className="min-h-dvh">
      <CourseSiteHeader />
      <Breadcrumbs
        items={[{ label: "home", href: "/dashboard" }, { label: "courses", href: "/courses" }, { label: course.title.toLowerCase() }]}
      />
      <section className="bg-grid border-b border-line bg-accent-wash/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 md:py-20">
          <p className="w-fit rounded-full border border-accent/20 bg-surface-raised px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase shadow-[var(--shadow-sm)]">
            <Link href="/courses" className="hover:text-ink">
              Courses
            </Link>
            <span className="px-1.5">/</span>
            {course.title}
          </p>
          <h1 className="text-hero text-balance text-ink">{course.title}</h1>
          <p className="max-w-2xl text-body leading-relaxed text-ink-muted">{course.tagline}</p>
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            {course.level} · {totalChapters(course)} chapters · {totalMinutes(course)} min
          </p>
          <CourseHeroProgress
            courseSlug={course.slug}
            chapters={course.modules.flatMap((m) => m.chapters.map((c) => ({ slug: c.slug, title: c.title })))}
          />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <ol className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {course.modules.map((module, mi) => (
            <li key={module.title} className="overflow-hidden rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-heading text-ink">
                  Module {mi + 1} — {module.title}
                </h2>
                <ModuleProgress courseSlug={course.slug} chapterSlugs={module.chapters.map((c) => c.slug)} />
              </div>
              <ol className="mt-5 flex flex-col divide-y divide-line border-y border-line">
                {module.chapters.map((chapter, ci) => (
                  <li key={chapter.slug}>
                    <Link
                      href={`/courses/${course.slug}/${chapter.slug}`}
                      className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3.5 transition-colors hover:bg-accent-wash"
                    >
                      <span className="flex items-center gap-3">
                        <ChapterDoneMark courseSlug={course.slug} chapterSlug={chapter.slug} />
                        <span className="font-mono text-micro text-ink-subtle">
                          {String(mi + 1)}.{String(ci + 1)}
                        </span>
                        <span className="text-caption text-ink"><InlineText text={chapter.title} /></span>
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
