/**
 * Types for static course content (task 045, PRD design brief 15 Sep 2026 — courses).
 *
 * Content is structured blocks rather than markdown/MDX: no new parser dependency, and a
 * fixed set of block kinds means the reader can style each one deliberately (an analogy
 * reads differently from a pitfall) instead of falling back to generic prose styling.
 */

export type Block =
  /** A paragraph. Inline `` `code` `` and `**bold**` are supported by the renderer. */
  | { kind: "p"; text: string }
  /** A sub-heading inside a chapter. Gets an anchor id for the "on this page" rail. */
  | { kind: "h"; text: string }
  /** The everyday picture the concept is mapped onto. */
  | { kind: "analogy"; title: string; text: string }
  /** A Java snippet or complete program. `output` is real `java` output, pasted, not guessed. */
  | { kind: "code"; code: string; caption?: string; output?: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "table"; head: string[]; rows: string[][] }
  /** A dry run, step by step — for anything with changing state (loops, recursion, references). */
  | { kind: "trace"; title: string; steps: string[] }
  /** Mistakes beginners actually make, with the fix. */
  | { kind: "pitfall"; items: string[] }
  /** The "never forget" box: 3-5 one-line memory hooks. */
  | { kind: "remember"; items: string[] }
  /** How the topic is commonly tested in interviews. Never a named company's specific question. */
  | { kind: "interview"; items: string[] }
  /** Tests understanding, not recall. Reveals `why` on interaction. */
  | { kind: "quiz"; question: string; options: string[]; answer: number; why: string };

export interface Chapter {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
}

export interface Module {
  title: string;
  chapters: Chapter[];
}

export interface Course {
  slug: string;
  title: string;
  tagline: string;
  level: string;
  modules: Module[];
}
