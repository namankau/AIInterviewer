"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ArenaPlayPanel } from "@/components/arena/arena-play-panel";
import type { Challenge } from "@/lib/arena/types";

/**
 * Reads `?chapter=<slug>` client-side (via `useSearchParams`, inside a `Suspense`
 * boundary in the page) so the page itself stays statically generated
 * (`generateStaticParams`, matching `/courses/[course]`) instead of every request
 * becoming dynamic just because a query string might be present — the only reason this
 * one small piece is a client component at all.
 *
 * `allCourseChallenges` is fetched here, client-side, from `/api/arena/challenges/[course]`
 * rather than passed down as a server-component prop (task 056, L3). Unlike the daily
 * quest, which the server can narrow to a handful of possible dates, a practice run is
 * drawn from the learner's own review schedule (`pickSessionChallenges`, inside
 * `ArenaSession`) — a genuinely client-side selection over the whole course corpus, so
 * there's no way to hand down fewer challenges up front without changing what a session
 * can pick from. Fetching keeps the corpus (which can run into the hundreds of challenges,
 * `viz` frames included) out of the page's static HTML and RSC payload; it only crosses the
 * wire once someone actually opens this page, and only for the one course they're on.
 *
 * `courseSlug` is not watched for staleness here — the state simply doesn't reset if it
 * changes on an already-mounted instance. The caller (`app/arena/[course]/page.tsx`) gives
 * this component `key={courseSlug}`, so a navigation to a different course always mounts a
 * fresh instance instead of reusing one that might show the previous course's challenges.
 */
export function ArenaCoursePractice({
  courseSlug,
  chapters,
}: {
  courseSlug: string;
  chapters: { slug: string; title: string }[];
}) {
  const searchParams = useSearchParams();
  const focusChapterSlug = searchParams.get("chapter") ?? undefined;
  const focusChapter = focusChapterSlug ? chapters.find((c) => c.slug === focusChapterSlug) : undefined;

  const [allCourseChallenges, setAllCourseChallenges] = useState<Challenge[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/arena/challenges/${courseSlug}`)
      .then((res) => {
        if (!res.ok) throw new Error(`unexpected status ${res.status}`);
        return res.json() as Promise<Challenge[]>;
      })
      .then((data) => {
        if (!cancelled) setAllCourseChallenges(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  if (failed) {
    return (
      <p role="alert" className="text-body text-ink-muted">
        We couldn&apos;t load this course&rsquo;s practice questions. Reload the page to try again.
      </p>
    );
  }

  if (allCourseChallenges === null) {
    return <p className="text-body text-ink-muted">Loading practice questions&hellip;</p>;
  }

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
