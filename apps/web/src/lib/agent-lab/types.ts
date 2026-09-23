/**
 * The agent lab's data model (task 057).
 *
 * Everything here is authored content, not model output. A scenario is a small, fully
 * specified world: a goal, a set of tools, a set of system-prompt clauses the learner can
 * switch on and off, and an ordered plan of what a competent agent would do. The runtime
 * (`run.ts`) walks that plan under the learner's settings and produces a trace.
 *
 * Why a plan and not a model: CLAUDE.md rule 7 forbids live AI spend, and inventing a
 * fake "model" that appears to reason would teach a reader something false about what is
 * happening on their screen. A scripted plan, labelled as one, teaches the *loop* — which
 * is the thing this course is actually about — without pretending to be the part it
 * cannot be.
 */

/** A tool the learner can give the agent, as the agent would see it. */
export interface LabTool {
  name: string;
  /**
   * The description variants the learner can choose between. The first is the accurate
   * one; a later one is deliberately vague or wrong, so the reader can break the tool
   * description and watch the tool call go wrong. Most tools have exactly one.
   */
  descriptions: LabToolDescription[];
  /** Parameters, as a tool schema would state them. */
  parameters: { name: string; type: string; description: string }[];
  /** What this tool stands in for in the real world — shown under the tool card. */
  about: string;
}

export interface LabToolDescription {
  id: string;
  /** A short handle for the radio control, e.g. "Precise" / "Vague". */
  label: string;
  /** The description text itself — what a model would actually read. */
  text: string;
  /**
   * True when choosing this description makes the agent misuse the tool. The plan's
   * `misled` branch is what runs; nothing is randomised.
   */
  misleading?: boolean;
}

/**
 * One clause of the system prompt, as a switch rather than free text.
 *
 * A scripted runtime can only react to instructions it was written to understand, so
 * offering a free-text box and then ignoring what was typed would be a lie told by the
 * interface. Clauses are real, visible sentences with real, specified effects; the
 * component says plainly that a real model reads whatever you type.
 */
export interface LabClause {
  id: string;
  /** The sentence that goes into the system prompt when this is on. */
  text: string;
  /** What switching it on actually changes in the run. */
  effect: ClauseEffect;
  /** One line explaining the lesson, shown beside the switch. */
  note: string;
}

/**
 * The three clause effects the runtime models. Each is a real behaviour people forget to
 * ask for, and each is visible in the trace:
 *
 * - `use-tools-first` — without it, the agent answers from what it already "knows"
 *   instead of looking anything up.
 * - `stop-when-answered` — without it, the agent keeps working after it has the answer,
 *   and only the step limit ends the run.
 * - `admit-uncertainty` — without it, an agent that cannot look something up invents a
 *   confident answer instead of saying it does not know.
 */
export type ClauseEffect = "use-tools-first" | "stop-when-answered" | "admit-uncertainty";

/** One intended step of the plan: a thought, an action, and what the action returns. */
export interface LabStep {
  thought: string;
  /** The tool this step calls. Must be one of the scenario's tools. */
  tool: string;
  args: Record<string, string>;
  /** The observation the tool returns when called correctly. */
  observation: string;
  /**
   * What happens instead when the tool's misleading description is selected: the wrong
   * call the agent makes, and the error it gets back. Set only on the step whose tool has
   * a misleading variant.
   */
  misled?: { args: Record<string, string>; observation: string; thought: string };
  /**
   * Steps after the goal is already satisfied. With `stop-when-answered` switched on the
   * agent stops before these run; without it, it keeps going and burns the step limit.
   */
  afterAnswer?: boolean;
}

export interface LabScenario {
  id: string;
  title: string;
  /** The goal, in the learner's words — what they are asking the agent to achieve. */
  goal: string;
  /** What this particular lab is here to teach. Shown above the controls. */
  brief: string;
  tools: LabTool[];
  clauses: LabClause[];
  /** Step limits the learner can pick between. The first is the default. */
  stepLimits: number[];
  plan: LabStep[];
  /**
   * When true, an agent that runs past the end of the plan wraps back to the first
   * `afterAnswer` step instead of finishing — a genuine loop, so the only thing that ever
   * ends the run is the step limit. Set on the scenario whose lesson is exactly that.
   */
  loopsAfterAnswer?: boolean;
  /** The answer the agent gives once the plan has produced what the goal needs. */
  answer: string;
  /**
   * The answer the agent gives when it has no tool it needs and no instruction to admit
   * uncertainty: a confident, wrong, invented one. Marked wrong in the trace, because
   * that is exactly the point.
   */
  guessedAnswer: string;
  /** The answer it gives instead when `admit-uncertainty` is on and it cannot look up. */
  honestAnswer: string;
  /** Three or four lines the reader should take away, shown after a run finishes. */
  lessons: string[];
}

/** The learner's settings for one run. */
export interface LabSettings {
  /** Tool names that are switched on. */
  enabledTools: string[];
  /** Chosen description id per tool name. Missing means the first (accurate) one. */
  descriptionChoice: Record<string, string>;
  /** Clause ids that are switched on. */
  enabledClauses: string[];
  stepLimit: number;
  /** When false, the agent is not shown what its actions returned. */
  showObservations: boolean;
}

export type LabFrame =
  | { kind: "thought"; step: number; text: string }
  | { kind: "action"; step: number; tool: string; args: Record<string, string>; wrong?: boolean }
  | { kind: "observation"; step: number; text: string; hidden?: boolean; error?: boolean }
  /** The agent wanted a tool it was not given. */
  | { kind: "blocked"; step: number; text: string }
  | { kind: "answer"; step: number; text: string; correct: boolean }
  /** The run hit the step limit with no answer. */
  | { kind: "stopped"; step: number; text: string };

export interface LabTrace {
  frames: LabFrame[];
  /** Steps actually consumed — a step is one thought/action/observation cycle. */
  stepsUsed: number;
  /** How the run ended. */
  outcome: "answered" | "guessed" | "admitted-uncertainty" | "step-limit" | "stuck";
  /** True only when the agent reached the answer the goal asked for. */
  succeeded: boolean;
}
