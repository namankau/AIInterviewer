import { describe, expect, it } from "vitest";

import { defaultSettings, runAgentLab, systemPromptText } from "@/lib/agent-lab/run";
import { agentLabScenarios, getScenario } from "@/lib/agent-lab/scenarios";
import type { LabScenario, LabSettings } from "@/lib/agent-lab/types";

/**
 * Behaviour tests for the agent lab's runtime (task 057) — the four things the lab exists
 * to teach, each asserted as an outcome rather than as a frame-by-frame snapshot, so
 * rewording an observation string does not break the test that guards the lesson.
 */

function scenario(id: string): LabScenario {
  const found = getScenario(id);
  expect(found, `scenario ${id} should exist`).toBeDefined();
  return found!;
}

function withSettings(base: LabScenario, patch: Partial<LabSettings>): LabSettings {
  return { ...defaultSettings(base), ...patch };
}

describe("runAgentLab — the loop itself", () => {
  it("steps forward one thought/action/observation cycle at a time and reaches the answer", () => {
    const refund = scenario("refund-status");
    const trace = runAgentLab(refund, withSettings(refund, { stepLimit: 8 }));

    expect(trace.outcome).toBe("answered");
    expect(trace.succeeded).toBe(true);
    expect(trace.stepsUsed).toBe(2);
    expect(trace.frames.map((f) => f.kind)).toEqual([
      "thought",
      "action",
      "observation",
      "thought",
      "action",
      "observation",
      "answer",
    ]);
  });

  it("makes the second call with an argument that only the first observation could have supplied", () => {
    const refund = scenario("refund-status");
    const trace = runAgentLab(refund, withSettings(refund, { stepLimit: 8 }));
    const actions = trace.frames.filter((f) => f.kind === "action");

    expect(actions[0]).toMatchObject({ tool: "find_order" });
    // RFD-9182 appears nowhere in the goal; it came out of the first tool result.
    expect(actions[1]).toMatchObject({ tool: "check_refund_status", args: { refund_id: "RFD-9182" } });
    expect(refund.goal).not.toContain("RFD-9182");
  });

  it("is deterministic: the same scenario and settings produce an identical trace every time", () => {
    for (const s of agentLabScenarios) {
      const settings = defaultSettings(s);
      expect(runAgentLab(s, settings)).toEqual(runAgentLab(s, settings));
    }
  });

  it("never spins: every scenario terminates under every offered step limit and both observation modes", () => {
    for (const s of agentLabScenarios) {
      for (const stepLimit of s.stepLimits) {
        for (const showObservations of [true, false]) {
          const trace = runAgentLab(s, withSettings(s, { stepLimit, showObservations }));
          expect(trace.stepsUsed).toBeLessThanOrEqual(stepLimit);
          expect(trace.frames.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("runAgentLab — a tool the agent was not given", () => {
  it("blocks on the missing tool rather than pretending to call it", () => {
    const refund = scenario("refund-status");
    const trace = runAgentLab(refund, withSettings(refund, { enabledTools: [], stepLimit: 8 }));

    expect(trace.frames.some((f) => f.kind === "blocked")).toBe(true);
    expect(trace.frames.some((f) => f.kind === "action")).toBe(false);
    expect(trace.succeeded).toBe(false);
  });

  it("invents a confident answer when nothing told it to admit uncertainty", () => {
    const refund = scenario("refund-status");
    const trace = runAgentLab(
      refund,
      withSettings(refund, { enabledTools: [], enabledClauses: ["use-tools"], stepLimit: 8 }),
    );

    expect(trace.outcome).toBe("guessed");
    const answer = trace.frames.find((f) => f.kind === "answer");
    expect(answer).toMatchObject({ correct: false, text: refund.guessedAnswer });
  });

  it("says it does not know when the admit-uncertainty clause is on", () => {
    const refund = scenario("refund-status");
    const trace = runAgentLab(
      refund,
      withSettings(refund, { enabledTools: [], stepLimit: 8 }),
    );

    expect(trace.outcome).toBe("admitted-uncertainty");
    expect(trace.frames.find((f) => f.kind === "answer")).toMatchObject({ text: refund.honestAnswer });
  });

  it("answers from memory, with no tool call at all, when not told to look things up", () => {
    const refund = scenario("refund-status");
    const trace = runAgentLab(refund, withSettings(refund, { enabledClauses: [], stepLimit: 8 }));

    expect(trace.frames.some((f) => f.kind === "action")).toBe(false);
    expect(trace.outcome).toBe("guessed");
  });
});

describe("runAgentLab — a broken tool description changes the outcome", () => {
  it("makes a different, rejected call when the vague description is chosen", () => {
    const trains = scenario("train-booking");
    const good = runAgentLab(trains, withSettings(trains, { stepLimit: 10 }));
    const bad = runAgentLab(
      trains,
      withSettings(trains, { stepLimit: 10, descriptionChoice: { search_trains: "vague" } }),
    );

    const goodFirst = good.frames.find((f) => f.kind === "action");
    const badFirst = bad.frames.find((f) => f.kind === "action");

    expect(goodFirst).toMatchObject({ args: { from: "PUNE" } });
    expect(goodFirst?.kind === "action" && goodFirst.wrong).toBeFalsy();
    expect(badFirst).toMatchObject({ args: { from: "Pune" }, wrong: true });
    expect(bad.frames.some((f) => f.kind === "observation" && f.error === true)).toBe(true);
    // Same goal, same tools, same data — one more step, purely because of the description.
    expect(bad.stepsUsed).toBe(good.stepsUsed + 1);
  });

  it("still gets there, because it was shown the error and could correct itself", () => {
    const trains = scenario("train-booking");
    const bad = runAgentLab(
      trains,
      withSettings(trains, { stepLimit: 10, descriptionChoice: { search_trains: "vague" } }),
    );
    expect(bad.outcome).toBe("answered");
  });

  it("cannot correct itself when the error is hidden from it, and burns the step limit", () => {
    const trains = scenario("train-booking");
    const blind = runAgentLab(
      trains,
      withSettings(trains, {
        stepLimit: 6,
        showObservations: false,
        descriptionChoice: { search_trains: "vague" },
      }),
    );

    expect(blind.outcome).toBe("step-limit");
    const actions = blind.frames.filter((f) => f.kind === "action");
    expect(actions.length).toBe(6);
    // Every attempt is the same wrong call — nothing new ever entered its context.
    expect(actions.every((a) => a.kind === "action" && a.wrong === true)).toBe(true);
  });
});

describe("runAgentLab — a step limit is what stops an agent that was never told to stop", () => {
  it("stops cleanly at the step limit, with no answer", () => {
    const pantry = scenario("pantry-restock");
    const trace = runAgentLab(
      pantry,
      withSettings(pantry, { stepLimit: 9, enabledClauses: ["use-tools", "admit"] }),
    );

    expect(trace.outcome).toBe("step-limit");
    expect(trace.stepsUsed).toBe(9);
    expect(trace.frames.at(-1)).toMatchObject({ kind: "stopped" });
    expect(trace.succeeded).toBe(false);
  });

  it("keeps placing the same real order every time round the loop", () => {
    const pantry = scenario("pantry-restock");
    const trace = runAgentLab(
      pantry,
      withSettings(pantry, { stepLimit: 9, enabledClauses: ["use-tools", "admit"] }),
    );
    const orders = trace.frames.filter((f) => f.kind === "action" && f.tool === "order_item");
    expect(orders.length).toBeGreaterThan(1);
  });

  it("finishes in two steps when the stopping clause is on, however high the limit", () => {
    const pantry = scenario("pantry-restock");
    const trace = runAgentLab(pantry, withSettings(pantry, { stepLimit: 9 }));

    expect(trace.outcome).toBe("answered");
    expect(trace.stepsUsed).toBe(2);
  });

  it("a limit lower than the work needed stops the run before the answer", () => {
    const helpdesk = scenario("helpdesk-reset");
    const trace = runAgentLab(helpdesk, withSettings(helpdesk, { stepLimit: 2 }));

    expect(trace.outcome).toBe("step-limit");
    expect(trace.succeeded).toBe(false);
  });
});

describe("runAgentLab — an agent that cannot see its results cannot correct itself", () => {
  it("repeats its first call until the limit when observations are hidden", () => {
    const helpdesk = scenario("helpdesk-reset");
    const trace = runAgentLab(helpdesk, withSettings(helpdesk, { stepLimit: 6, showObservations: false }));

    expect(trace.outcome).toBe("step-limit");
    const tools = trace.frames.filter((f) => f.kind === "action").map((f) => (f.kind === "action" ? f.tool : ""));
    expect(new Set(tools)).toEqual(new Set(["find_user"]));
    expect(trace.frames.every((f) => f.kind !== "observation" || f.hidden === true)).toBe(true);
  });

  it("reaches every one of its four tools when observations are shown", () => {
    const helpdesk = scenario("helpdesk-reset");
    const trace = runAgentLab(helpdesk, withSettings(helpdesk, { stepLimit: 8 }));

    const tools = trace.frames.filter((f) => f.kind === "action").map((f) => (f.kind === "action" ? f.tool : ""));
    expect(tools).toEqual(["find_user", "check_email_log", "update_email", "resend_reset"]);
    expect(trace.outcome).toBe("answered");
  });
});

describe("systemPromptText", () => {
  it("contains exactly the clauses that are switched on, in the scenario's order", () => {
    const pantry = scenario("pantry-restock");
    const text = systemPromptText(pantry, withSettings(pantry, { enabledClauses: ["stop"] }));

    expect(text).toContain("Stop as soon as you have what the goal asked for");
    expect(text).not.toContain("Never answer from memory");
  });
});

describe("the scenarios themselves", () => {
  it("have unique ids, at least one tool, at least one clause, and a plan", () => {
    const ids = agentLabScenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const s of agentLabScenarios) {
      expect(s.tools.length).toBeGreaterThan(0);
      expect(s.clauses.length).toBeGreaterThan(0);
      expect(s.plan.length).toBeGreaterThan(0);
      expect(s.stepLimits.length).toBeGreaterThan(0);
      expect(s.lessons.length).toBeGreaterThanOrEqual(3);
      expect(s.goal.trim().length).toBeGreaterThan(0);
      expect(s.brief.trim().length).toBeGreaterThan(0);
    }
  });

  it("only plan steps that name a tool the scenario actually defines", () => {
    for (const s of agentLabScenarios) {
      const names = new Set(s.tools.map((t) => t.name));
      for (const step of s.plan) {
        expect(names.has(step.tool), `${s.id}: ${step.tool}`).toBe(true);
      }
    }
  });

  it("give every tool at least one description, with the accurate one first", () => {
    for (const s of agentLabScenarios) {
      for (const tool of s.tools) {
        expect(tool.descriptions.length).toBeGreaterThan(0);
        expect(tool.descriptions[0]?.misleading).toBeFalsy();
        for (const d of tool.descriptions) {
          expect(d.text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("offer a step limit high enough for the required steps of every scenario", () => {
    for (const s of agentLabScenarios) {
      const required = s.plan.filter((step) => !step.afterAnswer).length;
      expect(Math.max(...s.stepLimits)).toBeGreaterThanOrEqual(required);
    }
  });

  it("have a misleading description only where the plan has a misled branch to run", () => {
    for (const s of agentLabScenarios) {
      const misleadingTools = s.tools
        .filter((t) => t.descriptions.some((d) => d.misleading))
        .map((t) => t.name);
      for (const name of misleadingTools) {
        expect(s.plan.some((step) => step.tool === name && step.misled), `${s.id}: ${name}`).toBe(true);
      }
    }
  });
});
