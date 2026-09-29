import { BlockRenderer } from "@/components/courses/block-renderer";
import { MarkCompleteButton } from "@/components/courses/course-progress";
import { GuidedLessonControls } from "@/components/courses/guided-lesson-controls";
import type { Block } from "@/content/courses/types";
import type { CodeBlockHighlight } from "@/lib/highlight-code";

type Highlight = string | CodeBlockHighlight | null;

type IndexedBlock = {
  block: Block;
  highlighted: Highlight;
};

type Beat = {
  key: "see" | "predict" | "interact" | "explain" | "check";
  label: string;
  shortLabel: string;
  description: string;
  blocks: IndexedBlock[];
};

const INTERACTIVE_KINDS: ReadonlySet<Block["kind"]> = new Set([
  "code",
  "trace",
  "table",
  "viz",
  "playground",
  "compare",
  "steps",
  "agentlab",
  "architecturelab",
]);

const BEAT_COPY = {
  see: {
    label: "See the idea",
    shortLabel: "See it",
    description: "Start with the everyday picture and the smallest useful idea.",
  },
  predict: {
    label: "Take a first guess",
    shortLabel: "Predict",
    description: "Try one question before the full explanation, then compare your thinking later.",
  },
  interact: {
    label: "Try it yourself",
    shortLabel: "Try it",
    description: "Run, trace, compare, or change the idea and watch what happens.",
  },
  explain: {
    label: "Explain and remember",
    shortLabel: "Remember",
    description: "Connect the result to the rule, common mistakes, and interview use.",
  },
  check: {
    label: "Final checkpoint",
    shortLabel: "Check",
    description: "Answer the remaining questions to prove the idea has stuck.",
  },
} as const;

/**
 * Turns an authored chapter into the same five-beat learning rhythm without making
 * chapter files repeat presentation metadata. The first authored quiz becomes a low-stakes
 * diagnostic; later quizzes remain the final checkpoint.
 *
 * Apart from that one deliberate lift, ranges stay contiguous and in authored order. An
 * earlier kind-based implementation collected every code/viz/table into Try and every
 * paragraph into Remember, which put examples before their explanations and separated
 * headings from the blocks they introduced in more than half the corpus. Boundaries keep
 * those teaching relationships intact. Original indexes travel with every block so Shiki
 * output never becomes detached from its source block.
 */
export function buildGuidedLessonBeats(blocks: Block[], highlightedCode: Highlight[]): Beat[] {
  const indexed = blocks.map((block, index) => ({
    block,
    highlighted: highlightedCode[index] ?? null,
  }));
  const quizzes = indexed.filter(({ block }) => block.kind === "quiz");
  const firstQuiz = quizzes[0];
  const firstQuizIndex = firstQuiz ? indexed.indexOf(firstQuiz) : -1;
  const secondQuizIndex = quizzes[1] ? indexed.indexOf(quizzes[1]!) : indexed.length;
  const beforeCheck = indexed.slice(0, secondQuizIndex);
  const firstInteractiveIndex = beforeCheck.findIndex(({ block }) => INTERACTIVE_KINDS.has(block.kind));
  const lastInteractiveIndex = beforeCheck.findLastIndex(({ block }) => INTERACTIVE_KINDS.has(block.kind));

  let interactStart = firstInteractiveIndex;
  if (firstInteractiveIndex >= 0) {
    const headingIndex = beforeCheck
      .slice(0, firstInteractiveIndex)
      .findLastIndex(({ block }) => block.kind === "h");
    if (headingIndex >= 0) interactStart = headingIndex;
  }

  const notFirstQuiz = (_entry: IndexedBlock, index: number) => index !== firstQuizIndex;
  const see = interactStart < 0
    ? beforeCheck.filter(notFirstQuiz)
    : beforeCheck.slice(0, interactStart).filter(notFirstQuiz);
  const interact = interactStart < 0
    ? []
    : beforeCheck.slice(interactStart, lastInteractiveIndex + 1).filter((_, offset) =>
        interactStart + offset !== firstQuizIndex,
      );
  const explain = lastInteractiveIndex < 0
    ? []
    : beforeCheck.slice(lastInteractiveIndex + 1).filter((_, offset) =>
        lastInteractiveIndex + 1 + offset !== firstQuizIndex,
      );
  const check = indexed.slice(secondQuizIndex);

  const groups = {
    see,
    predict: quizzes.slice(0, 1),
    interact,
    explain,
    check,
  };

  return (["see", "predict", "interact", "explain", "check"] as const).map((key) => ({
    key,
    ...BEAT_COPY[key],
    blocks: groups[key],
  }));
}

export function GuidedLesson({
  blocks,
  chapterSlug,
  courseSlug,
  highlightedCode = [],
}: {
  blocks: Block[];
  chapterSlug?: string;
  courseSlug?: string;
  highlightedCode?: Highlight[];
}) {
  const beats = buildGuidedLessonBeats(blocks, highlightedCode);

  return (
    <GuidedLessonControls
      completion={
        courseSlug && chapterSlug ? (
          <MarkCompleteButton courseSlug={courseSlug} chapterSlug={chapterSlug} />
        ) : undefined
      }
      beats={beats.map((beat) => ({
        key: beat.key,
        label: beat.label,
        shortLabel: beat.shortLabel,
        description: beat.description,
        itemCount: beat.blocks.length,
        content: beat.blocks.length > 0 ? (
          <BlockRenderer
            blocks={beat.blocks.map(({ block }) => block)}
            highlightedCode={beat.blocks.map(({ highlighted }) => highlighted)}
          />
        ) : null,
      }))}
    />
  );
}
