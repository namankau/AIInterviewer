"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ArenaPlayPanel } from "@/components/arena/arena-play-panel";
import type { Challenge } from "@/lib/arena/types";

/**
 * Reads `?chapter=<slug>` client-side (via `useSearchParams`, inside a `Suspense`
 * boundary in the page) so the page itself stays statically generated
 * (`generateStaticParams`, matching `/courses/[course]`) instead of every request
 * becoming dynamic just because a query string might be present — the only reason this
 * one small piece is a client component at all.
 */
export function ArenaCoursePractice({
  courseSlug,
  allCourseChallenges,
  chapters,
}: {
  courseSlug: string;
  allCourseChallenges: Challenge[];
  chapters: { slug: string; title: string }[];
}) {
  const searchParams = useSearchParams();
  const focusChapterSlug = searchParams.get("chapter") ?? undefined;
  const focusChapter = focusChapterSlug ? chapters.find((c) => c.slug === focusChapterSlug) : undefined;
  const focusChallenges = focusChapter
    ? allCourseChallenges.filter((c) => c.chapterSlug === focusChapter.slug)
    : [];
  const challenges = focusChallenges.length > 0 ? focusChallenges : allCourseChallenges;

  return (
    <div className="flex flex-col gap-3">
      {focusChapter && focusChallenges.length > 0 ? (
        <p className="text-caption text-ink-muted">
          Scoped to <span className="font-medium text-ink">{focusChapter.title}</span> —{" "}
          <Link href={`/arena/${courseSlug}`} className="text-accent hover:underline">
            practise the whole course instead
          </Link>
          .
        </p>
      ) : null}
      <ArenaPlayPanel
        challenges={challenges}
        courseSlug={courseSlug}
        startLabel={focusChapter && focusChallenges.length > 0 ? `Practise ${focusChapter.title}` : "Start practice"}
        emptyLabel="This course doesn't have any derived challenges yet."
      />
    </div>
  );
}
