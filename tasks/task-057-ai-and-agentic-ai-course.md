# Task 057 — an AI and Agentic AI course, with a place to actually build an agent

The owner's words: "introduce another course about AI and Agentic AI learning and Agent
making with place to actually interactively build agent... this is trending thing and would
definitely gain us followers... with many quizzes, interactive and laymen learning terms and
close to real life examples so anyone can learn that. DON'T REINVENT THE WHEEL BUT USE OPEN
SOURCE DATA AND INFO AVAILABLE."

This is the third course, alongside `java` and `dsa`. It uses the framework that already
exists — `content/courses/types.ts`, `BlockRenderer`, `CourseToc`, course progress, the
Arena — and adds exactly one thing to it: the agent lab.

## Read first
- `apps/web/src/content/courses/types.ts` — every block kind, and the doc comment on each
  explaining what it is *for*. Use the ones that fit; do not invent a block kind that
  duplicates one that exists.
- `apps/web/src/content/courses/dsa/05-two-pointers.ts` — what a good chapter looks like here.
- `apps/web/src/content/courses/content-integrity.test.ts` — the bar content is held to.
- `apps/web/src/lib/arena/derive.ts` — a new course automatically grows the Arena, because
  challenges are derived from `quiz`, `pitfall`, `compare`, `viz` and `code` blocks. Writing
  rich blocks here is worth more than it looks.
- CLAUDE.md, especially the design direction and rule 7 (no live AI spend).

## Ground it in open sources — this is the owner's explicit instruction

Do not write this course from memory. Research first, with the web tools, and cite. The
canonical, openly available material to work from includes (verify each one actually says
what you think before you lean on it):

- ReAct: *Synergizing Reasoning and Acting in Language Models* (arXiv 2210.03629) — the
  thought/action/observation loop that every agent framework is a variation on.
- Anthropic, *Building Effective Agents* — workflows vs agents, and the patterns
  (prompt chaining, routing, parallelisation, orchestrator-workers, evaluator-optimiser).
- The Model Context Protocol specification — the open standard for how an agent reaches a
  tool. It is open source; read the spec, not a blog summary of it.
- *Chain-of-Thought Prompting Elicits Reasoning* (arXiv 2201.11903).
- *Retrieval-Augmented Generation* (arXiv 2005.11401) for the memory/retrieval module.
- *Attention Is All You Need* (arXiv 1706.03762) for the one chapter that has to say what a
  transformer is without hand-waving.
- The open documentation of at least two agent frameworks (LangGraph, OpenAI Agents SDK,
  smolagents, CrewAI) so the "frameworks" chapter describes what they actually do.

A claim about how a named framework or model behaves is held to the same bar this codebase
holds a claim about a named employer to: sourced, or not made. When you are describing a
general pattern rather than a specific system, say so.

## Reading level

Class-12 student with no programming background assumed for the first module, and no ML
background assumed anywhere. Every chapter carries what the other two courses carry: one
vivid everyday analogy, small steps, complete runnable code with real pasted output, a
"remember this" box, the mistakes people actually make, and a self-check. The owner asked
for **many quizzes** and **real-life examples** — at least two `quiz` blocks per chapter, and
examples drawn from things a person does (booking a train, chasing a refund, a kitchen with
a recipe and a pantry) rather than from abstractions.

Code is Python here, not Java — that is what this field is written in, and the framework
already supports `playground` blocks with `language: "python"` that genuinely run in the
browser (`lib/browser-python.ts`). Use them. Code that calls a hosted model cannot run in a
playground; show it as a `code` block with honest, real, pasted output and say where it
would run.

## Suggested shape — roughly 30 chapters, six modules

1. **What these models actually are** — prediction, tokens, context, why they invent things,
   what they cannot do. The honest foundation everything else rests on.
2. **Talking to a model** — prompting, structure, few-shot, chain of thought, why "be more
   accurate" does nothing.
3. **From a model to an agent** — the loop. Tools, the ReAct cycle, observations, stopping
   conditions. This is the heart of the course and where the agent lab lives.
4. **Giving an agent a memory** — retrieval, embeddings, RAG, short vs long term memory,
   why a vector search is not magic.
5. **More than one agent** — the workflow patterns from the Anthropic piece, orchestration,
   handoffs, and the honest answer to "when is a single call better than an agent?"
6. **Making it real** — MCP, evaluation, cost, latency, failure modes, safety, and what
   actually goes wrong in production.

Adjust the shape if the research says something better. Say what you changed and why.

## The agent lab — the thing the owner asked for

A new block kind in the same spirit as `playground`: the learner **assembles an agent and
watches it run**. They choose a goal, write the system prompt, pick tools from a fixed set,
set a step limit, and press Run — then step through the thought / action / observation /
answer trace, one frame at a time.

**It is a simulation, and it must say so on its face.** CLAUDE.md rule 7 forbids live model
spend without the owner, and a lab that silently pretends a scripted trace came from a real
model is the same failure as a report describing eye contact nobody watched. Label it
plainly, in the UI, in as many words: this runs a scripted agent locally, no model is called,
nothing leaves the browser. Design it so that wiring a real model in later is a change of
runtime and not a rewrite — but do not wire one.

What the lab has to teach, because these are the things people get wrong:
- A wrong tool description produces a wrong tool call. Let them break it and see.
- An agent with no stopping condition loops until something stops it.
- An agent that cannot see the result of its action cannot correct itself.
- The prompt is not a wish; the loop is what does the work.

Make at least three lab scenarios, each in the chapter it belongs to. Deterministic — same
inputs, same trace, every time, no `Math.random`, no clock.

## Constraints
- Branch from `origin/develop` as `feat/ai-agents-course`.
- Register the course in `content/courses/index.ts`. Check what else assumes exactly two
  courses and fix it (the landing page, `/courses`, `/arena`, any test with a hard-coded
  count) — `grep` for it rather than guessing.
- **No new dependencies.** The lab is hand-rolled from what is here.
- This will be far over the ~800-line reviewability guideline. That is expected for a course;
  commit and push **per module** so it can be read in pieces, and record the size in HANDOFF.
- Full verification loop. Push the branch and stop; do not merge, and do not push to `main`.
- Tests: the content integrity test must cover the new course; the agent lab needs behaviour
  tests (a trace steps forward, a step limit stops it, a broken tool description changes the
  outcome) and accessibility tests, not snapshots.
