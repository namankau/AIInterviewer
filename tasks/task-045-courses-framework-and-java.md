# Task 045 — Courses: framework + Java programming course

Owner request, 15 Sep 2026: courses like GeeksforGeeks / TutorialsPoint — a course
with chapters from the very start — but every topic explained "as if taught to a class-12
student, so once they read it they never forget it". Phase 1: **Java programming** and
**DSA**. This task: the framework and the Java course. Task 046 does DSA.

## Architecture (decided — record in HANDOFF, don't relitigate)
- Course content is static educational content, not interview logic, so it lives in the
  web app as typed TypeScript data: `apps/web/src/content/courses/`. Pages are
  statically generated (`generateStaticParams`) for search. Public — no sign-in. Check
  `src/proxy.ts` so `/courses/**` is not redirected to login.
- No new dependencies (no MDX, no markdown parser). Content is structured blocks:

```ts
// apps/web/src/content/courses/types.ts  (refine if needed, keep it small)
export type Block =
  | { kind: "p"; text: string }            // inline `code` and **bold** supported by the renderer
  | { kind: "h"; text: string }            // sub-heading inside a chapter (gets an anchor id)
  | { kind: "analogy"; title: string; text: string }   // the everyday picture
  | { kind: "code"; code: string; caption?: string; output?: string } // Java
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "trace"; title: string; steps: string[] }  // dry run, step by step
  | { kind: "pitfall"; items: string[] }               // common mistakes
  | { kind: "remember"; items: string[] }              // the "never forget" box
  | { kind: "interview"; items: string[] }             // how it comes up in interviews
  | { kind: "quiz"; question: string; options: string[]; answer: number; why: string };
export interface Chapter { slug: string; title: string; summary: string; minutes: number; blocks: Block[] }
export interface Module { title: string; chapters: Chapter[] }
export interface Course { slug: string; title: string; tagline: string; level: string; modules: Module[] }
```
  One file per chapter (`content/courses/java/<nn>-<slug>.ts`), one index per course,
  a registry `content/courses/index.ts`.

## Pages (use the design tokens — task 044 re-themes in parallel)
- `/courses` — catalogue: course cards (title, tagline, chapter count, total minutes,
  level), InterviewBit-style.
- `/courses/[course]` — course home: hero band, module-by-module chapter list, "Start
  course" CTA.
- `/courses/[course]/[chapter]` — reader: left sidebar TOC (modules → chapters, current
  highlighted; collapsible drawer on mobile), readable ~70ch article column, right
  "on this page" anchors on wide screens, prev/next chapter at the bottom, breadcrumb.
  Distinct styles per block kind (analogy = tinted callout, remember = highlighted box,
  pitfall = warning callout, quiz = interactive reveal client component, code = mono
  block with a copy button and an "Output" panel). Per-page `metadata` (title,
  description) for SEO. Keyboard-accessible.
- Add "Courses" to the site nav.

## Tests (vitest)
- Content integrity over **every** registered chapter: unique slugs, ≥1 analogy, ≥1
  code block (Java course), 1 remember box, ≥1 quiz with `answer` in range, summary
  non-empty. Prev/next ordering across module boundaries. Renderer renders each block
  kind accessibly; quiz reveals the answer on interaction.

## Writing standard (applies to every chapter — this is the product)
Write for a bright class-12 student in India who has never programmed.
1. **Hook** — open with a question or situation they already know.
2. **One precise analogy** from everyday life (cricket scorecard, tiffin box, school
   register, railway reservation chart, WhatsApp group, library shelf…). Map every part
   of the analogy onto the concept, and say in one line where the analogy stops working.
3. **Small steps.** Define every term the first time it appears. Short sentences. No
   jargon without a plain-words translation.
4. **Code that runs.** Complete, minimal programs (Java 17) with the exact output in
   `output`. Compile and run every complete program locally with `javac`/`java` in a
   scratch dir (not committed) and paste real output. Snippets that aren't full programs
   say so in the caption.
5. **Trace** anything with changing state (loops, recursion, references).
6. **Common mistakes** — the ones beginners actually make, with the fix.
7. **Remember box** — 3–5 one-line memory hooks; a mnemonic where natural.
8. **Quiz** — 2–3 questions that test understanding, not recall; `why` explains.
9. **Interview angle** — how the topic is commonly tested. Never claim a named company
   asks a specific question.
10. Technically exact. Where the simple version is a simplification, say so.
Length: roughly 900–1800 words per chapter.

## Java course chapters (this task writes modules 1–3; task 045b writes 4–6)
1. **Getting started:** what Java is and how it runs (JDK/JRE/JVM, bytecode, WORA);
   your first program (anatomy of `main`); variables and data types (primitives,
   memory sizes); operators; input and output (Scanner, printf); type casting.
2. **Control flow:** if/else and switch (incl. switch expressions); loops (for, while,
   do-while); break, continue and nested loops (patterns).
3. **Arrays, strings, methods:** arrays (1D, 2D); strings (immutability, pool, equals
   vs ==); StringBuilder; methods (params, return, overloading, pass-by-value);
   recursion basics.
4. **OOP:** classes and objects; constructors and `this`; `static`; encapsulation and
   access modifiers; inheritance and `super`; polymorphism (overloading vs overriding);
   abstract classes and interfaces; packages.
5. **Core APIs:** exceptions (checked/unchecked, try/catch/finally, custom); wrapper
   classes and autoboxing; collections overview; ArrayList vs LinkedList; HashMap and
   HashSet (how hashing works, equals/hashCode); generics; Comparable and Comparator.
6. **Beyond basics:** file I/O; stack, heap and garbage collection; multithreading
   basics; lambdas and functional interfaces; Streams API; records and modern Java
   features.

Branch `feat/courses-java`. Commit after the framework, then after each module. Push,
stop. Verify with the full web verification loop.
