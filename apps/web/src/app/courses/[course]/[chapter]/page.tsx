import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CodeLanguageProvider } from "@/components/courses/code-language-context";
import { GuidedLesson } from "@/components/courses/guided-lesson";
import { CourseToc } from "@/components/courses/course-toc";
import {
  courses,
  flattenChapters,
  getAdjacentChapters,
  getChapter,
  getCourse,
  getModuleForChapter,
} from "@/content/courses";
import { InlineText, plainText } from "@/components/courses/inline-text";
import { highlightChapterBlocks } from "@/lib/highlight-code";
import { challengesForChapter } from "@/lib/arena/corpus";
import { toCourseTocData } from "@/lib/course-toc-data";

export function generateStaticParams() {
  return courses.flatMap((course) =>
    flattenChapters(course).map((chapter) => ({ course: course.slug, chapter: chapter.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string; chapter: string }>;
}): Promise<Metadata> {
  const { course: courseSlug, chapter: chapterSlug } = await params;
  const chapter = getChapter(courseSlug, chapterSlug);
  if (!chapter) return {};
  return {
    title: `${plainText(chapter.title)} — AceMyInterview`,
    description: plainText(chapter.summary),
  };
}

/**
 * The chapter reader: course navigation on the left, a guided five-beat lesson in the
 * main track, and previous/next chapter navigation at the bottom (task 059).
 *
 * The lesson track is fluid (`minmax(0,1fr)`), not a fixed prose width (task 052) —
 * prose blocks (paragraphs, asides, lists) cap themselves at 70ch in `BlockRenderer` so a
 * sentence never gets harder to read, but `viz`/`code`/`table`/`compare`/`steps`/
 * `playground` blocks fill the whole track, so a 1920px screen gives a diagram real room
 * instead of squeezing it into a text column that never wanted it.
 */
export default async function ChapterPage({
  params,
}: {
  params: Promise<{ course: string; chapter: string }>;
}) {
  const { course: courseSlug, chapter: chapterSlug } = await params;
  const course = getCourse(courseSlug);
  if (!course) notFound();
  const chapter = getChapter(courseSlug, chapterSlug);
  if (!chapter) notFound();

  const chapterModule = getModuleForChapter(course, chapterSlug);
  const { prev, next } = getAdjacentChapters(course, chapterSlug);
  const arenaCount = challengesForChapter(course.slug, chapter.slug).length;
  const courseToc = toCourseTocData(course);
  const interviewTopic = `${plainText(course.title)}: ${plainText(chapter.title)}`;
  const topicInterviewHref = `/interview/new?topic=${encodeURIComponent(interviewTopic)}` as Route;
  // Shiki runs here, at build time (this page is statically generated via
  // generateStaticParams), so the highlighted HTML ships with the page and zero
  // highlighting JS reaches the browser (task 049).
  const highlightedCode = await highlightChapterBlocks(chapter.blocks, course.codeLanguage ?? "java");

  return (
    <AppShell
      wide
      breadcrumb={chapter.slug}
      parent={{ label: course.title.toLowerCase(), href: `/courses/${course.slug}` as Route }}
    >
      <div className="grid gap-10 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-12">
        <CourseToc course={courseToc} currentSlug={chapter.slug} />

        <article className="min-w-0">
          <div className="max-w-[70ch]">
            <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
              {chapterModule ? chapterModule.title : course.title} · {chapter.minutes} min
            </p>
            <h1 className="mt-3 text-display text-balance text-ink"><InlineText text={chapter.title} /></h1>
            <p className="mt-3 text-body text-ink-muted">{chapter.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={topicInterviewHref}
                className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-caption font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                Practise this topic in an interview
              </Link>
              {arenaCount > 0 ? (
                <Link
                  href={`/arena/${course.slug}?chapter=${chapter.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-1.5 text-caption font-medium text-accent transition-colors hover:border-accent"
                >
                  Practise this chapter in the Arena
                  <span className="text-ink-subtle">· {arenaCount}</span>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-10">
            <CodeLanguageProvider>
              <GuidedLesson
                blocks={chapter.blocks}
                chapterSlug={chapter.slug}
                courseSlug={course.slug}
                highlightedCode={highlightedCode}
              />
            </CodeLanguageProvider>
          </div>

          <nav aria-label="Chapter navigation" className="mt-8 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:justify-between">
            {prev ? (
              <Link
                href={`/courses/${course.slug}/${prev.slug}`}
                className="flex flex-col rounded-md border border-line px-4 py-3 text-caption transition-colors hover:border-line-strong sm:max-w-[48%]"
              >
                <span className="font-mono text-micro text-ink-subtle uppercase">Previous</span>
                <span className="text-ink"><InlineText text={prev.title} /></span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/courses/${course.slug}/${next.slug}`}
                className="group flex flex-col rounded-xl border border-accent bg-accent px-5 py-3.5 text-left text-caption text-accent-contrast shadow-[var(--shadow-sm)] transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-[var(--shadow-md)] sm:ml-auto sm:max-w-[52%] sm:text-right"
              >
                <span className="font-mono text-micro text-accent-contrast/75 uppercase">Next chapter</span>
                <span className="mt-0.5 flex items-center gap-2 font-semibold sm:justify-end">
                  <InlineText text={next.title} />
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
      </div>
    </AppShell>
  );
}
