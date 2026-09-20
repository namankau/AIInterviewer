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
  | { kind: "quiz"; question: string; options: string[]; answer: number; why: string }
  /**
   * A step-through visual: the same "dry run, step by step" job as `trace`, but the steps
   * carry structured state (cells, pointers, nodes, edges) instead of sentences, so a
   * renderer can draw each frame instead of the reader imagining it (task 047).
   */
  | { kind: "viz"; title: string; caption?: string; viz: Viz }
  /**
   * An editable, runnable "try it yourself" block (task 049) — separate from `code`
   * rather than a flag on it, because the two are rendered by entirely different paths:
   * `code` is highlighted once at build time and shipped as static HTML, while a
   * `playground` seeds a client-side editor and (for Python) an in-browser interpreter.
   * Keeping them apart means a static `code` sample never accidentally pulls in the
   * editor bundle, and a chapter can mix "read this" snippets with "try this" ones freely.
   *
   * Only `language: "python"` can actually run — see `getRunner` in
   * `lib/course-code-runner.ts`. A `java` playground still renders (editable, copyable)
   * but shows an honest explanation in place of Run; there is no free, unencumbered way
   * to execute Java in the browser as of Feb 2026 (see `browser-python.ts` and task 049).
   */
  | {
      kind: "playground";
      language: "python" | "java";
      /** Seed source. "Reset to original" restores exactly this string. */
      starter: string;
      /** A short task line shown above the editor, e.g. "Change `nums` and run again." */
      prompt?: string;
      /** What a correct, unmodified run should print — compared loosely (trailing whitespace only). */
      expectedOutput?: string;
    };

/**
 * One visualisation and its frames. Every shape's frame is *state*, never coordinates —
 * layout is the renderer's job, not the content author's, which is what keeps this
 * declarative and keeps a frame reviewable as data.
 */
export type Viz =
  | { type: "array"; frames: ArrayFrame[] }
  | { type: "list"; frames: ListFrame[] }
  | { type: "stack" | "queue"; frames: SeqFrame[] }
  | { type: "tree"; frames: TreeFrame[] }
  | { type: "graph"; frames: GraphFrame[] }
  | { type: "table"; frames: GridFrame[] }
  | { type: "callstack"; frames: CallFrame[] };

/** Visual state of one element within a frame. Never the only signal — always paired
 * with a label, a pointer name, or position, per CLAUDE.md (never colour alone). */
export type CellState = "active" | "window" | "done" | "compare" | "swap" | "visiting";

export interface ArrayCell {
  value: string | number;
  /** Named pointers landing on this index, e.g. `["left"]`, `["i", "j"]`. */
  pointers?: string[];
  state?: CellState;
}
export interface ArrayFrame {
  cells: ArrayCell[];
  note: string;
  /** Optional highlighted contiguous range (a window), inclusive indices into `cells`. */
  range?: [number, number];
}

export interface ListNode {
  id: string;
  value: string | number;
  /** id of the next node, or `null` for the end of the list. */
  next: string | null;
  pointers?: string[];
  state?: CellState;
}
export interface ListFrame {
  /** Nodes in list order, starting from the head. */
  nodes: ListNode[];
  note: string;
}

export interface SeqFrame {
  items: (string | number)[];
  note: string;
  /** Index of the item just pushed/popped/enqueued/dequeued this frame. */
  highlight?: number;
}

export interface TreeNode {
  id: string;
  value: string | number;
  left: string | null;
  right: string | null;
  state?: CellState;
}
export interface TreeFrame {
  nodes: TreeNode[];
  rootId: string;
  note: string;
}

export interface GraphNode {
  id: string;
  label: string;
  state?: CellState;
}
export interface GraphEdge {
  from: string;
  to: string;
  directed?: boolean;
  state?: CellState;
}
export interface GraphFrame {
  nodes: GraphNode[];
  edges: GraphEdge[];
  note: string;
}

export interface GridFrame {
  /** `null` marks an empty cell (e.g. an unfilled DP table entry). */
  rows: (string | number | null)[][];
  rowLabels?: string[];
  colLabels?: string[];
  /** `[row, col]` pairs to highlight this frame. */
  highlight?: [number, number][];
  note: string;
}

export interface CallFrame {
  /** The call stack, bottom to top. */
  stack: { label: string; state?: "active" | "returning" }[];
  note: string;
}

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
