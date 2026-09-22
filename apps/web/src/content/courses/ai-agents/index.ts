import { chapterWhatIsALanguageModel } from "@/content/courses/ai-agents/01-what-is-a-language-model";
import { chapterTokens } from "@/content/courses/ai-agents/02-tokens";
import { chapterTheContextWindow } from "@/content/courses/ai-agents/03-the-context-window";
import { chapterWhyModelsMakeThingsUp } from "@/content/courses/ai-agents/04-why-models-make-things-up";
import { chapterWhatATransformerIs } from "@/content/courses/ai-agents/05-what-a-transformer-is";
import type { Course } from "@/content/courses/types";

/**
 * AI and Agentic AI (task 057). The third course, alongside `java` and `dsa`, and the
 * first whose code is Python — hence `codeLanguage`.
 *
 * Every non-obvious claim in this course is grounded in an openly published source, named
 * in the chapter that uses it: the ReAct paper (arXiv:2210.03629), Anthropic's *Building
 * Effective Agents*, the Model Context Protocol specification, chain-of-thought prompting
 * (arXiv:2201.11903), RAG (arXiv:2005.11401), *Attention Is All You Need*
 * (arXiv:1706.03762), *Lost in the Middle* (arXiv:2307.03172), *Why Language Models
 * Hallucinate* (arXiv:2509.04664), the OWASP Top 10 for LLM Applications, and the open
 * documentation of LangGraph, the OpenAI Agents SDK and smolagents. CLAUDE.md holds a
 * claim about a named framework or model to the same bar as a claim about a named
 * employer: sourced, or not made. Where the text describes a general pattern rather than a
 * specific system, it says so.
 *
 * The agent lab (module 3) is a **scripted local simulation** and says so on its face. No
 * chapter in this course, and no code path it reaches, calls a model — CLAUDE.md rule 7.
 */
export const aiAgentsCourse: Course = {
  slug: "ai-agents",
  title: "AI and Agentic AI",
  tagline:
    "From \"what is a language model\" to an agent you assemble and run yourself — in plain language, " +
    "grounded in the papers and specs, with nothing invented.",
  level: "Beginner — no machine learning background, and no programming needed for the first module",
  codeLanguage: "python",
  modules: [
    {
      title: "What these models actually are",
      chapters: [
        chapterWhatIsALanguageModel,
        chapterTokens,
        chapterTheContextWindow,
        chapterWhyModelsMakeThingsUp,
        chapterWhatATransformerIs,
      ],
    },
  ],
};
