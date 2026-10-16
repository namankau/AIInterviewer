import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ArenaCoursePractice } from "@/components/arena/arena-course-practice";
import { courses, getCourse } from "@/content/courses";
import { courseEnabled, featureEnabled } from "@/lib/flags";
import { requireArenaCourse } from "@/lib/require-feature";

export function generateStaticParams() {
  if (!featureEnabled("arena")) return [];
  return courses.filter((course) => courseEnabled(course.slug)).map((course) => ({ course: course.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const { course: slug } = await params;
  const course = getCourse(slug);
  return course ? { title: `${course.title} — Arena — Untiered`, description: `Scenario practice for ${course.title}.` } : {};
}

export default async function ArenaCoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  requireArenaCourse(slug);
  const course = getCourse(slug);
  if (!course) notFound();
  return (
    <AppShell breadcrumb={course.title.toLowerCase()} parent={{ label: "arena", href: "/arena" }}>
      <div className="space-y-8"><header className="hero-band px-7 py-9 sm:px-10"><p className="pill pill-navy w-fit">Scenario practice</p><h1 className="mt-4 text-display text-on-navy">{course.title} Arena</h1><p className="mt-3 max-w-2xl text-body text-on-navy-muted">{course.tagline}</p></header>
        <div className="rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] md:p-8"><ArenaCoursePractice key={slug} courseSlug={slug} /></div>
      </div>
    </AppShell>
  );
}
