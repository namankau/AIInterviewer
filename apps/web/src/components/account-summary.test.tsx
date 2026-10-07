import type { MeResponse } from "@acemyinterview/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
   * Sign out moved off the rail once because a permanently visible control is clutter and
   * easy to hit. It is back on the owner's request (7 Oct 2026), but behind the name: the
   * menu is closed until asked for, so nothing destructive sits in the furniture.
   */
  it("keeps the account actions closed until the name is pressed", async () => {
    fetchMe.mockResolvedValue(me);

    render(<AccountSummary />);

    const trigger = await screen.findByRole("button", { name: /account menu for test candidate/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /profile and resume/i })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: /all your rounds/i })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("link", { name: /delete account/i })).toHaveAttribute(
      "href",
      "/profile#delete-account",
    );
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("signs out from the menu", async () => {
    fetchMe.mockResolvedValue(me);
    render(<AccountSummary />);

    await userEvent.click(await screen.findByRole("button", { name: /account menu/i }));
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and gives focus back to the name", async () => {
    fetchMe.mockResolvedValue(me);
    render(<AccountSummary />);

    const trigger = await screen.findByRole("button", { name: /account menu/i });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
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
