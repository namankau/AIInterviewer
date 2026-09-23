import type { LabFrame, LabScenario, LabSettings, LabTrace } from "@/lib/agent-lab/types";

/**
 * The agent lab's runtime (task 057).
 *
 * **No model is called here, and no code path in this file can call one.** This is a pure
 * function from authored data plus the learner's settings to a trace — no `fetch`, no
 * `Math.random`, no `Date.now`. Running it twice with the same arguments produces the
 * same frames, in the same order, every time; the lab's tests rely on that, and so does
 * the promise the component makes to the reader on its face.
 *
 * It is written as a loop with a cursor, deliberately mirroring the shape of a real agent
 * loop (see the ReAct paper, arXiv:2210.03629, and the runner loop the OpenAI Agents SDK
 * documents), so the four things it exists to teach fall out of the loop rather than being
 * special-cased narration:
 *
 * 1. A tool the agent was not given is a tool it cannot call — so it either says it does
 *    not know, or it invents something. Which one depends on whether you asked it to.
 * 2. A misleading tool description produces a wrong call. The agent can only recover if it
 *    is shown the error it got back.
 * 3. Without a stopping condition, the loop is ended by the step limit and nothing else.
 * 4. An agent that cannot see the result of its action cannot advance — it repeats itself
 *    until something stops it.
 *
 * Swapping in a real model later means replacing the body of this loop with an async call
 * and keeping everything around it: the scenario data, the settings, the frame shapes, the
 * component. That is a change of runtime, not a rewrite. It is not done here, and must not
 * be done without the owner (CLAUDE.md rule 7).
 */
export function runAgentLab(scenario: LabScenario, settings: LabSettings): LabTrace {
  const frames: LabFrame[] = [];
  let stepsUsed = 0;

  const enabled = new Set(settings.enabledTools);
  const clauses = new Set(settings.enabledClauses);
  const effects = new Set(
    scenario.clauses.filter((clause) => clauses.has(clause.id)).map((clause) => clause.effect),
  );
  const mustUseTools = effects.has("use-tools-first");
  const stopWhenAnswered = effects.has("stop-when-answered");
  const admitUncertainty = effects.has("admit-uncertainty");

  const stepLimit = Math.max(1, Math.floor(settings.stepLimit));

  /** True when the learner picked the deliberately misleading description for this tool. */
  function isMisled(toolName: string): boolean {
    const tool = scenario.tools.find((t) => t.name === toolName);
    if (!tool) return false;
    const chosenId = settings.descriptionChoice[toolName] ?? tool.descriptions[0]?.id;
    return Boolean(tool.descriptions.find((d) => d.id === chosenId)?.misleading);
  }

  function finishWithoutLookup(step: number): LabTrace {
    if (admitUncertainty) {
      frames.push({ kind: "answer", step, text: scenario.honestAnswer, correct: false });
      return { frames, stepsUsed, outcome: "admitted-uncertainty", succeeded: false };
    }
    frames.push({ kind: "answer", step, text: scenario.guessedAnswer, correct: false });
    return { frames, stepsUsed, outcome: "guessed", succeeded: false };
  }

  // No instruction to look anything up: the agent answers from what is already in its
  // context, tools or no tools. This is the "the prompt is not a wish" lesson — an
  // instruction you did not give is work the agent does not do.
  if (!mustUseTools) {
    stepsUsed = 1;
    frames.push({
      kind: "thought",
      step: 1,
      text:
        "Nothing in my instructions tells me to look this up, and I can produce something " +
        "that reads like an answer straight away. I will just answer.",
    });
    return finishWithoutLookup(1);
  }

  const requiredSteps = scenario.plan.filter((step) => !step.afterAnswer).length;
  const firstAfterAnswer = scenario.plan.findIndex((step) => step.afterAnswer);

  /** Plan steps whose misleading call has already been made *and* seen, so it is fixed. */
  const recovered = new Set<number>();
  let cursor = 0;

  // The loop is bounded twice over: by the step limit, and by the fact that every
  // iteration either consumes a step or exits. It cannot spin.
  for (;;) {
    if (cursor >= requiredSteps && stopWhenAnswered) {
      frames.push({ kind: "answer", step: stepsUsed, text: scenario.answer, correct: true });
      return { frames, stepsUsed, outcome: "answered", succeeded: true };
    }

    if (cursor >= scenario.plan.length) {
      if (scenario.loopsAfterAnswer && firstAfterAnswer >= 0) {
        // Nothing told it to stop, so it goes round again. Only the step limit ends this.
        cursor = firstAfterAnswer;
      } else {
        frames.push({ kind: "answer", step: stepsUsed, text: scenario.answer, correct: true });
        return { frames, stepsUsed, outcome: "answered", succeeded: true };
      }
    }

    const step = scenario.plan[cursor];
    if (!step) {
      frames.push({ kind: "answer", step: stepsUsed, text: scenario.answer, correct: true });
      return { frames, stepsUsed, outcome: "answered", succeeded: true };
    }

    if (!enabled.has(step.tool)) {
      // A tool it was not given. It cannot call it, and no amount of prompting changes that.
      stepsUsed += 1;
      frames.push({ kind: "thought", step: stepsUsed, text: step.thought });
      frames.push({
        kind: "blocked",
        step: stepsUsed,
        text: `I need \`${step.tool}\` for this, and it is not in the tools I was given.`,
      });
      return finishWithoutLookup(stepsUsed);
    }

    if (stepsUsed >= stepLimit) {
      frames.push({
        kind: "stopped",
        step: stepsUsed,
        text:
          `Step limit of ${stepLimit} reached. The run ends here with no answer — the loop ` +
          "did not decide it was finished, the limit did.",
      });
      return { frames, stepsUsed, outcome: "step-limit", succeeded: false };
    }

    stepsUsed += 1;

    const misled = isMisled(step.tool) && step.misled && !recovered.has(cursor);
    if (misled && step.misled) {
      frames.push({ kind: "thought", step: stepsUsed, text: step.misled.thought });
      frames.push({ kind: "action", step: stepsUsed, tool: step.tool, args: step.misled.args, wrong: true });
      frames.push({
        kind: "observation",
        step: stepsUsed,
        text: step.misled.observation,
        error: true,
        hidden: !settings.showObservations,
      });
      // It can only learn from the error if it is shown the error.
      if (settings.showObservations) recovered.add(cursor);
      continue;
    }

    frames.push({ kind: "thought", step: stepsUsed, text: step.thought });
    frames.push({ kind: "action", step: stepsUsed, tool: step.tool, args: step.args });
    frames.push({
      kind: "observation",
      step: stepsUsed,
      text: step.observation,
      hidden: !settings.showObservations,
    });

    // Without the observation, there is nothing new in the agent's context — so the next
    // turn looks exactly like this one, and it makes the same call again.
    if (settings.showObservations) cursor += 1;
  }
}

/**
 * The settings a lab opens with: every tool on, accurate descriptions, every clause on,
 * observations shown, the first offered step limit. A first Run succeeds — the learner
 * then breaks one thing at a time and watches what that costs, which is the way round
 * that actually teaches.
 */
export function defaultSettings(scenario: LabScenario): LabSettings {
  return {
    enabledTools: scenario.tools.map((tool) => tool.name),
    descriptionChoice: Object.fromEntries(
      scenario.tools.map((tool) => [tool.name, tool.descriptions[0]?.id ?? ""]),
    ),
    enabledClauses: scenario.clauses.map((clause) => clause.id),
    stepLimit: scenario.stepLimits[0] ?? 6,
    showObservations: true,
  };
}

/** The assembled system prompt, exactly as the switched-on clauses read. */
export function systemPromptText(scenario: LabScenario, settings: LabSettings): string {
  const on = new Set(settings.enabledClauses);
  const lines = scenario.clauses.filter((clause) => on.has(clause.id)).map((clause) => clause.text);
  return ["You are an assistant that can use tools.", ...lines].join("\n");
}
