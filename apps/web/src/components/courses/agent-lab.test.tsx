import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AgentLab } from "@/components/courses/agent-lab";
import { getScenario } from "@/lib/agent-lab/scenarios";
import type { LabScenario } from "@/lib/agent-lab/types";

/**
 * Behaviour and accessibility for the agent lab (task 057). No snapshots: what matters is
 * that a reader can drive the thing from the keyboard, that the trace advances one frame
 * at a time, and — above all — that the page says on its face that nothing here calls a
 * model.
 */

function scenario(id: string): LabScenario {
  const found = getScenario(id);
  if (!found) throw new Error(`missing scenario ${id}`);
  return found;
}

const refund = scenario("refund-status");
const trains = scenario("train-booking");
const pantry = scenario("pantry-restock");
const helpdesk = scenario("helpdesk-reset");

describe("AgentLab — the honesty label", () => {
  it("says, in words, that this is a simulation and no model is called", () => {
    render(<AgentLab scenario={refund} />);
    expect(screen.getByText(/simulation — no model is called/i)).toBeInTheDocument();
    expect(screen.getByText(/scripted agent in your browser/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing you choose or click is sent anywhere/i)).toBeInTheDocument();
  });

  it("shows the label before anything has been run, not only after", () => {
    render(<AgentLab scenario={refund} />);
    expect(screen.getByText(/no model is called/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing has run yet/i)).toBeInTheDocument();
  });
});

describe("AgentLab — stepping through a trace", () => {
  it("reveals one frame at a time and reaches the correct answer", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={refund} />);

    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    expect(screen.getByText(/frame 1 of/i)).toBeInTheDocument();
    expect(screen.queryByText(refund.answer)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next frame/i }));
    expect(screen.getByText(/frame 2 of/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText(refund.answer)).toBeInTheDocument();
  });

  it("steps back as well as forward, and cannot go back past the first frame", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={refund} />);

    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    expect(screen.getByRole("button", { name: /^back$/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /next frame/i }));
    expect(screen.getByRole("button", { name: /^back$/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByText(/frame 1 of/i)).toBeInTheDocument();
  });

  it("shows the takeaway lessons only once the whole trace has been revealed", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={refund} />);
    const firstLesson = refund.lessons[0]!;

    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    expect(screen.queryByText(firstLesson)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText(firstLesson)).toBeInTheDocument();
  });

  it("clears a stale trace as soon as a setting changes", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={refund} />);

    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    await user.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText(refund.answer)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /find_order/i }));
    expect(screen.queryByText(refund.answer)).not.toBeInTheDocument();
    expect(screen.getByText(/nothing has run yet/i)).toBeInTheDocument();
  });
});

describe("AgentLab — taking a tool away", () => {
  it("blocks on the missing tool and invents an answer when nothing asks it to admit doubt", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={refund} />);

    await user.click(screen.getByRole("checkbox", { name: /find_order/i }));
    await user.click(screen.getByRole("checkbox", { name: /if you cannot look something up/i }));
    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    await user.click(screen.getByRole("button", { name: /show all/i }));

    expect(screen.getByText(/is not in the tools I was given/i)).toBeInTheDocument();
    expect(screen.getByText(refund.guessedAnswer)).toBeInTheDocument();
    expect(screen.getByText(/the answer is invented/i)).toBeInTheDocument();
  });

  it("says it does not know when the admit-uncertainty clause is left on", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={refund} />);

    await user.click(screen.getByRole("checkbox", { name: /find_order/i }));
    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    await user.click(screen.getByRole("button", { name: /show all/i }));

    expect(screen.getByText(refund.honestAnswer)).toBeInTheDocument();
  });
});

describe("AgentLab — a broken tool description", () => {
  it("produces a different, rejected tool call when the vague description is picked", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={trains} />);

    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    await user.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.queryByText(/unknown station/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /vague/i }));
    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    await user.click(screen.getByRole("button", { name: /show all/i }));

    expect(screen.getByText(/unknown station/i)).toBeInTheDocument();
    expect(screen.getByText(/^Step 1 · Action · wrong call$/i)).toBeInTheDocument();
    // It still gets there, because it was shown the error it caused.
    expect(screen.getByText(trains.answer)).toBeInTheDocument();
  });
});

describe("AgentLab — the step limit", () => {
  it("stops the run with no answer when nothing told the agent it was finished", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={pantry} />);

    await user.click(screen.getByRole("checkbox", { name: /stop as soon as you have/i }));
    await user.click(screen.getByRole("radio", { name: /9 steps/i }));
    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    await user.click(screen.getByRole("button", { name: /show all/i }));

    expect(screen.getByText(/step limit of 9 reached/i)).toBeInTheDocument();
    expect(screen.getByText(/cut off by the step limit with no answer/i)).toBeInTheDocument();
    expect(screen.queryByText(pantry.answer)).not.toBeInTheDocument();
  });
});

describe("AgentLab — hiding the observations", () => {
  it("marks every observation as hidden and never gets past the first tool", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={helpdesk} />);

    await user.click(screen.getByRole("checkbox", { name: /show the agent what its actions returned/i }));
    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    await user.click(screen.getByRole("button", { name: /show all/i }));

    expect(screen.getAllByText(/hidden from the agent/i).length).toBeGreaterThan(1);
    expect(screen.queryByText(/bounced: domain not found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(helpdesk.answer)).not.toBeInTheDocument();
  });
});

describe("AgentLab — accessibility", () => {
  it("names the lab region after its own title", () => {
    render(<AgentLab scenario={refund} />);
    const region = screen.getByRole("region", { name: refund.title });
    expect(within(region).getByRole("heading", { name: refund.title })).toBeInTheDocument();
  });

  it("groups every control under a labelled fieldset", () => {
    render(<AgentLab scenario={refund} />);
    expect(screen.getByRole("group", { name: /tools the agent may use/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /system prompt/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /step limit/i })).toBeInTheDocument();
  });

  it("gives every tool and clause switch an accessible name", () => {
    render(<AgentLab scenario={refund} />);
    for (const tool of refund.tools) {
      expect(screen.getByRole("checkbox", { name: new RegExp(tool.name) })).toBeInTheDocument();
    }
    for (const clause of refund.clauses) {
      expect(screen.getByRole("checkbox", { name: new RegExp(clause.text.slice(0, 24), "i") })).toBeInTheDocument();
    }
  });

  it("can be driven from the keyboard alone", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={refund} />);

    const run = screen.getByRole("button", { name: /run the agent/i });
    run.focus();
    expect(run).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByText(/frame 1 of/i)).toBeInTheDocument();
  });

  it("announces the trace and the outcome to assistive technology", async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentLab scenario={refund} />);

    await user.click(screen.getByRole("button", { name: /run the agent/i }));
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/reached the answer/i);
  });

  it("restores every default when Reset everything is pressed", async () => {
    const user = userEvent.setup();
    render(<AgentLab scenario={trains} />);

    await user.click(screen.getByRole("radio", { name: /vague/i }));
    await user.click(screen.getByRole("checkbox", { name: /check_availability/i }));
    await user.click(screen.getByRole("button", { name: /reset everything/i }));

    expect(screen.getByRole("radio", { name: /accurate/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /check_availability/i })).toBeChecked();
  });
});
