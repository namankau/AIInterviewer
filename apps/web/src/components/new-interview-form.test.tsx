import type { RoundDraft } from "@acemyinterview/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewInterviewForm } from "./new-interview-form";

const composeRound = vi.hoisted(() => vi.fn());
const startSession = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  composeRound,
  startSession,
  ApiRequestError: class ApiRequestError extends Error {},
}));

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const draft: RoundDraft = {
  companyName: "Infosys",
  roleTitle: "Senior Backend Engineer",
  level: "5 years",
  roundType: "techno_managerial",
  roundLabel: "Techno-managerial",
  durationMinutes: 40,
  language: "english",
  understood: "A techno-managerial round for a Senior Backend Engineer at Infosys.",
  assumptions: ["Read 'MR round' as techno-managerial", "Assumed a 40-minute round"],
  confidence: "high",
  archetypeLabel: "Service-based IT",
  archetypeConfidence: "recognised",
  groundingNote: "Run as a service-based IT loop. These are general patterns for that kind of employer.",
};

describe("NewInterviewForm", () => {
  beforeEach(() => {
    composeRound.mockReset();
    startSession.mockReset();
    push.mockReset();
  });

  it("turns one line into a round, and shows it back before anything starts", async () => {
    composeRound.mockResolvedValue(draft);
    render(<NewInterviewForm />);

    await userEvent.type(
      screen.getByLabelText(/describe the interview/i),
      "Infosys MR round next Tuesday",
    );
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));

    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());
    expect(composeRound).toHaveBeenCalledWith("token", "Infosys MR round next Tuesday");
    expect(screen.getByDisplayValue("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /techno-managerial/i })).toBeChecked();

    // Nothing has been created yet. The candidate still has to consent and confirm.
    expect(startSession).not.toHaveBeenCalled();
  });

  /**
   * A wrong guess would waste the round, and a candidate gets one free one. Everything
   * the model filled in has to be visible, and everything has to be editable.
   */
  it("lists what it assumed, and lets the candidate correct it", async () => {
    composeRound.mockResolvedValue(draft);
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());

    expect(screen.getByText(/read 'mr round' as techno-managerial/i)).toBeInTheDocument();

    const role = screen.getByDisplayValue("Senior Backend Engineer");
    await userEvent.clear(role);
    await userEvent.type(role, "Technology Lead");
    await userEvent.click(screen.getByRole("radio", { name: /behavioural/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() => expect(startSession).toHaveBeenCalled());
    expect(startSession.mock.calls[0][1]).toMatchObject({
      companyName: "Infosys",
      roleTitle: "Technology Lead",
      roundType: "behavioural_competency",
    });
  });

  it("shows the grounding note, so an unrecognised employer is known before the round", async () => {
    composeRound.mockResolvedValue({
      ...draft,
      companyName: "Sagitec Solutions",
      archetypeConfidence: "inferred",
      groundingNote:
        "We do not have specific information about Sagitec Solutions, so this runs on general service-based IT patterns.",
    });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Sagitec round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));

    await waitFor(() =>
      expect(screen.getByText(/we do not have specific information about sagitec/i)).toBeInTheDocument(),
    );
  });

  it("still starts a round when the composer cannot read the sentence", async () => {
    composeRound.mockRejectedValue(new Error("upstream down"));
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "something unparseable");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));

    // Degrades to the form rather than dead-ending: the round is the point, not the composer.
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /begin interview/i })).toBeInTheDocument();
  });

  it("offers a way in for someone who would rather just fill it in", async () => {
    render(<NewInterviewForm />);

    await userEvent.click(screen.getByRole("button", { name: /fill it in yourself/i }));

    expect(screen.getByRole("button", { name: /begin interview/i })).toBeInTheDocument();
    expect(composeRound).not.toHaveBeenCalled();
  });

  it("will not start without consent to record the candidate's voice", async () => {
    render(<NewInterviewForm />);
    await userEvent.click(screen.getByRole("button", { name: /fill it in yourself/i }));

    await userEvent.type(screen.getByPlaceholderText("Infosys"), "TCS");
    await userEvent.type(screen.getByPlaceholderText("Senior Backend Engineer"), "Systems Engineer");

    expect(screen.getByRole("button", { name: /begin interview/i })).toBeDisabled();
    expect(screen.getByText(/voice recording is required/i)).toBeInTheDocument();
  });
});
