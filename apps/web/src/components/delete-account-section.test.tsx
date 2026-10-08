import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteAccountSection } from "./delete-account-section";

const deleteAccount = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  deleteAccount,
  ApiRequestError: class ApiRequestError extends Error {},
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

/** Deleting an account cannot be undone, so the guard and the honesty of the result are what matter. */
describe("DeleteAccountSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says what goes, and will not delete until the word is typed", async () => {
    render(<DeleteAccountSection />);

    expect(screen.getByText(/report, transcript and voice recordings/i)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /delete my account/i });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/type delete to confirm/i), "delet");
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type delete to confirm/i), "e");
    expect(button).toBeEnabled();
  });

  it("deletes, then signs this browser out and leaves", async () => {
    deleteAccount.mockResolvedValue(undefined);
    render(<DeleteAccountSection />);

    await userEvent.type(screen.getByLabelText(/type delete to confirm/i), "delete");
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(deleteAccount).toHaveBeenCalledWith("token");
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("stays signed in and says so when the server refuses", async () => {
    deleteAccount.mockRejectedValue(new Error("offline"));
    render(<DeleteAccountSection />);

    await userEvent.type(screen.getByLabelText(/type delete to confirm/i), "delete");
    await userEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be deleted/i);
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
