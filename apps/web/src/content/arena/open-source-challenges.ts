import type { Challenge, ChallengeSource } from "@/lib/arena/types";

/**
 * Exact upstream material reviewed for the Arena supplement. These are content links,
 * not runtime dependencies: the app never fetches an upstream repository in production.
 */
export const ARENA_OPEN_SOURCE_REGISTRY = {
  exercismJava: {
    title: "Exercism Java track",
    publisher: "Exercism",
    url: "https://github.com/exercism/java/tree/8e2a83395a5bfe9faedb3ce03b1fd85f0bcb5423",
    license: "MIT",
    revision: "8e2a83395a5bfe9faedb3ce03b1fd85f0bcb5423",
    revisionDate: "2026-09-22",
    reviewedOn: "2026-09-24",
  },
  exercismProblemSpecifications: {
    title: "Exercism problem specifications",
    publisher: "Exercism",
    url: "https://github.com/exercism/problem-specifications/tree/82d94a395a24ae08e4b6a29bb8822c26eaac9ac9",
    license: "MIT",
    revision: "82d94a395a24ae08e4b6a29bb8822c26eaac9ac9",
    revisionDate: "2026-09-22",
    reviewedOn: "2026-09-24",
  },
  microsoftAiForBeginners: {
    title: "AI for Beginners",
    publisher: "Microsoft",
    url: "https://github.com/microsoft/AI-For-Beginners/tree/392d0df1b2647cbee104942390551f1ed9e072c8",
    license: "MIT",
    revision: "392d0df1b2647cbee104942390551f1ed9e072c8",
    revisionDate: "2026-09-04",
    reviewedOn: "2026-09-24",
  },
  microsoftAiAgentsForBeginners: {
    title: "AI Agents for Beginners",
    publisher: "Microsoft",
    url: "https://github.com/microsoft/ai-agents-for-beginners/tree/25b7985f3b2dc37a84f4a7387ccd3c9f0e5b1595",
    license: "MIT",
    revision: "25b7985f3b2dc37a84f4a7387ccd3c9f0e5b1595",
    revisionDate: "2026-09-09",
    reviewedOn: "2026-09-24",
  },
} as const satisfies Record<string, ChallengeSource>;

function source(
  registryKey: keyof typeof ARENA_OPEN_SOURCE_REGISTRY,
  path: string,
): ChallengeSource {
  const registered = ARENA_OPEN_SOURCE_REGISTRY[registryKey];
  return {
    ...registered,
    url: `${registered.url.replace("/tree/", "/blob/")}/${path}`,
  };
}

/**
 * A deliberately small reviewed supplement, adapted into multiple-choice checks rather
 * than copied wholesale. Every item maps to a chapter we actually teach and carries the
 * exact upstream file and revision behind it. Stable explicit ids protect saved FSRS
 * cards if the derived course corpus changes around these questions.
 */
export const openSourceArenaChallenges: Challenge[] = [
  {
    id: "open-exercism-java-lasagna-remaining-time-v1",
    kind: "mcq",
    courseSlug: "java",
    chapterSlug: "methods",
    moduleTitle: "Arrays, strings, methods",
    prompt: "A Java method expects 40 minutes in the oven. If 30 minutes have passed, what should remainingMinutesInOven return?",
    options: ["10", "30", "40", "70"],
    correctIndex: 0,
    why: "Remaining time is expected time minus elapsed time: 40 - 30 = 10 minutes.",
    source: source("exercismJava", "exercises/concept/lasagna/.docs/instructions.md"),
  },
  {
    id: "open-exercism-java-bird-watcher-last-index-v1",
    kind: "mcq",
    courseSlug: "java",
    chapterSlug: "arrays",
    moduleTitle: "Arrays, strings, methods",
    prompt: "A Java array stores daily bird counts from oldest to newest: [2, 5, 0, 7, 4, 1]. Which value represents today?",
    options: ["2", "0", "4", "1"],
    correctIndex: 3,
    why: "The newest count is the final array element, so today's value is 1.",
    source: source("exercismJava", "exercises/concept/bird-watcher/.docs/instructions.md"),
  },
  {
    id: "open-exercism-spec-binary-search-middle-v1",
    kind: "mcq",
    courseSlug: "dsa",
    chapterSlug: "binary-search",
    moduleTitle: "Sorting and searching",
    prompt: "Binary search looks for 6 in [1, 3, 4, 6, 8, 9, 11]. Which zero-based index should it return?",
    options: ["2", "3", "4", "6"],
    correctIndex: 1,
    why: "The value 6 is the fourth item, which has zero-based index 3.",
    source: source("exercismProblemSpecifications", "exercises/binary-search/canonical-data.json"),
  },
  {
    id: "open-exercism-spec-anagram-frequency-v1",
    kind: "mcq",
    courseSlug: "dsa",
    chapterSlug: "string-techniques",
    moduleTitle: "Arrays and strings",
    prompt: "Which candidates are anagrams of 'solemn' when every letter must be used exactly once?",
    options: ["lemons only", "melons only", "lemons and melons", "cherry and melons"],
    correctIndex: 2,
    why: "Both 'lemons' and 'melons' contain exactly the same letters with the same frequencies as 'solemn'.",
    source: source("exercismProblemSpecifications", "exercises/anagram/canonical-data.json"),
  },
  {
    id: "open-microsoft-ai-language-model-objective-v1",
    kind: "mcq",
    courseSlug: "ai-agents",
    chapterSlug: "what-is-a-language-model",
    moduleTitle: "What these models actually are",
    prompt: "Which training task is a common foundation for a language model?",
    options: ["Predicting a missing token", "Sorting a database table", "Measuring network latency", "Compiling source code"],
    correctIndex: 0,
    why: "Text supplies its own training signal: a token can be hidden and the model trained to predict it from context.",
    source: source("microsoftAiForBeginners", "lessons/5-NLP/15-LanguageModeling/README.md"),
  },
  {
    id: "open-microsoft-agents-tool-call-v1",
    kind: "mcq",
    courseSlug: "ai-agents",
    chapterSlug: "what-a-tool-is",
    moduleTitle: "From a model to an agent",
    prompt: "In a tool-calling loop, what does the model produce before application code runs the tool?",
    options: ["A tool name and arguments", "A database administrator password", "The tool's source code", "A guaranteed final answer"],
    correctIndex: 0,
    why: "The model selects a declared tool and proposes its arguments; application code validates and executes that call, then returns the result.",
    source: source("microsoftAiAgentsForBeginners", "04-tool-use/README.md"),
  },
];
