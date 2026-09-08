import type { MeResponse } from "@acemyinterview/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSummary } from "./account-summary";

const fetchMe = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  fetchMe,
  ApiRequestError: class extends Error {},
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession, signOut } }),
}));

// The way out now lives inside this block rather than floating at the foot of an empty
// rail, so this component has a router dependency it did not have before.
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const me: MeResponse = {
  id: "6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11",
  email: "candidate@example.com",
  displayName: "Test Candidate",
  preferredLanguage: "hindi_english",
  createdAt: "2026-08-25T10:00:00Z",
  profile: {
    function: null,
    currentLevel: null,
    targetLevel: null,
    totalExperienceMonths: null,
    peopleManagementScope: null,
    location: null,
    relocationIntent: null,
    workAuthorisationStatus: null,
    noticePeriodDays: null,
    compensationExpectation: null,
  },
};

describe("AccountSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: "token-abc" } } });
  });

  /**
   * This assertion was the other way round one commit ago, and the reversal is deliberate.
   * Sign out was moved onto the profile page: it is rare, it cannot be undone without a
   * password, and a control like that living permanently in the navigation is both clutter
   * and something to catch by accident. What is left here is the way *in* to the account.
   */
  it("is a way in to the profile, and does not carry the way out", async () => {
    fetchMe.mockResolvedValue(me);

    render(<AccountSummary />);

    expect(await screen.findByRole("link", { name: /test candidate/i })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("announces that it is loading before the profile arrives", () => {
    fetchMe.mockReturnValue(new Promise(() => {}));

    render(<AccountSummary />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading your profile/i);
  });

  it("shows the candidate and their interview language once loaded", async () => {
    fetchMe.mockResolvedValue(me);

    render(<AccountSummary />);

    expect(await screen.findByText("Test Candidate")).toBeInTheDocument();
    expect(screen.getByText("Hindi-English")).toBeInTheDocument();
  });

  it("sends the Supabase access token to the API", async () => {
    fetchMe.mockResolvedValue(me);

    render(<AccountSummary />);
    await screen.findByText("Test Candidate");

    expect(fetchMe).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "token-abc" }));
  });

  it("falls back to the email address when no display name was supplied", async () => {
    fetchMe.mockResolvedValue({ ...me, displayName: null });

    render(<AccountSummary />);

    expect(await screen.findByText("candidate@example.com")).toBeInTheDocument();
  });

  it("reports a failed profile load as an alert rather than an empty panel", async () => {
    fetchMe.mockRejectedValue(new Error("A valid Supabase access token is required."));

    render(<AccountSummary />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid supabase access token/i);
  });

  it("reports the missing session when the browser has no token at all", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    render(<AccountSummary />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no active session/i);
    expect(fetchMe).not.toHaveBeenCalled();
  });
});
