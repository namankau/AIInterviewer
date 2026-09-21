import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/courses/block-renderer";
import { CodeLanguageProvider } from "@/components/courses/code-language-context";
import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { CourseToc } from "@/components/courses/course-toc";
import { OnThisPage } from "@/components/courses/on-this-page";
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
 * The chapter reader: TOC on the left, ~70ch article column, "on this page" anchors on
 * wide screens, prev/next at the bottom (PRD design brief, 15 Sep 2026).
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
  // Shiki runs here, at build time (this page is statically generated via
  // generateStaticParams), so the highlighted HTML ships with the page and zero
  // highlighting JS reaches the browser (task 049).
  const highlightedCode = await highlightChapterBlocks(chapter.blocks);

  return (
    <div className="min-h-dvh">
      <CourseSiteHeader />
      <div className="border-b border-line px-6 py-3 md:px-12">
        <p className="mx-auto max-w-6xl font-mono text-micro tracking-widest text-ink-subtle lowercase">
          <Link href="/courses" className="hover:text-ink">
            courses
          </Link>
          <span className="px-1.5">/</span>
          <Link href={`/courses/${course.slug}`} className="hover:text-ink">
            {course.slug}
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-ink-muted">{chapter.slug}</span>
        </p>
      </div>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:px-12 md:py-14 xl:grid-cols-[220px_minmax(0,70ch)_180px] xl:gap-12">
        <CourseToc course={course} currentSlug={chapter.slug} />

        <article className="min-w-0">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            {chapterModule ? chapterModule.title : course.title} · {chapter.minutes} min
          </p>
          <h1 className="mt-3 text-display text-balance text-ink"><InlineText text={chapter.title} /></h1>
          <p className="mt-3 text-body text-ink-muted">{chapter.summary}</p>

          <div className="mt-10">
            <CodeLanguageProvider>
              <BlockRenderer blocks={chapter.blocks} highlightedCode={highlightedCode} />
            </CodeLanguageProvider>
          </div>

          <nav aria-label="Chapter navigation" className="mt-14 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:justify-between">
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
                className="flex flex-col rounded-md border border-line px-4 py-3 text-right text-caption transition-colors hover:border-line-strong sm:ml-auto sm:max-w-[48%]"
              >
                <span className="font-mono text-micro text-ink-subtle uppercase">Next</span>
                <span className="text-ink"><InlineText text={next.title} /></span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>

        <OnThisPage blocks={chapter.blocks} />
      </main>
      <CourseSiteFooter />
    </div>
  );
}
