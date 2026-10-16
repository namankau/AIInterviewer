import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CourseArtwork } from "@/components/courses/course-visuals";
import { courses } from "@/content/courses";
import { courseEnabled } from "@/lib/flags";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Arena — Untiered", description: "Course-specific scenario practice." };

export default function ArenaPage() {
  requireFeature("arena");
  const visibleCourses = courses.filter((course) => courseEnabled(course.slug));
  if (visibleCourses.length === 0) notFound();
  return (
    <AppShell breadcrumb="arena"><div className="space-y-8">
      <header className="hero-band px-7 py-9 sm:px-10"><p className="pill pill-navy w-fit">Arena</p><h1 className="mt-4 text-display text-on-navy">Practise decisions, not flashcards</h1><p className="mt-3 max-w-2xl text-body text-on-navy-muted">Choose a course and work through a real-world situation with deeper probes at every step.</p></header>
      <div className="grid gap-5 md:grid-cols-2">{visibleCourses.map((course) => (
        <Link key={course.slug} href={`/arena/${course.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"><CourseArtwork courseSlug={course.slug} /><div className="p-5"><h2 className="text-heading text-ink group-hover:text-accent">{course.title}</h2><p className="mt-2 text-caption text-ink-muted">{course.tagline}</p><p className="mt-4 font-semibold text-accent">Open Arena →</p></div></Link>
      ))}</div>
    </div></AppShell>
  );
}
