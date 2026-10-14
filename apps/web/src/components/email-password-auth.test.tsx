import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailPasswordAuth } from "./email-password-auth";

const { signInWithPassword, signUp, resetPasswordForEmail, replace, refresh } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword, signUp, resetPasswordForEmail } }),
}));

describe("EmailPasswordAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue({ error: null });
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("signs in with email and takes the candidate to the intended page", async () => {
    render(<EmailPasswordAuth next="/courses" />);
    await userEvent.type(screen.getByRole("textbox", { name: "Email address" }), "candidate@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({
      email: "candidate@example.com", password: "password123",
    }));
    expect(replace).toHaveBeenCalledWith("/courses");
    expect(refresh).toHaveBeenCalled();
  });

  it("requests confirmation when sign-up does not return a session", async () => {
    render(<EmailPasswordAuth next="/dashboard" />);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Email address" }), "candidate@example.com");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getAllByRole("button", { name: "Create account" })[1]!);

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    const options = signUp.mock.calls[0]?.[0];
    expect(options.email).toBe("candidate@example.com");
    expect(options.password).toBe("password123");
    const callback = new URL(options.options.emailRedirectTo);
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/dashboard");
    expect(await screen.findByRole("status")).toHaveTextContent(/check your email/i);
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords before contacting Supabase", async () => {
    render(<EmailPasswordAuth next="/dashboard" />);
    await userEvent.click(screen.getAllByRole("button", { name: "Create account" })[0]!);
    await userEvent.type(screen.getByRole("textbox", { name: "Email address" }), "candidate@example.com");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different123");
    await userEvent.click(screen.getAllByRole("button", { name: "Create account" })[1]!);

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("sends a password reset link to the update-password flow", async () => {
    render(<EmailPasswordAuth next="/courses" />);
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Email address" }), "candidate@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledTimes(1));
    const [email, options] = resetPasswordForEmail.mock.calls[0]!;
    expect(email).toBe("candidate@example.com");
    const callback = new URL(options.redirectTo);
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/auth/update-password");
    expect(await screen.findByRole("status")).toHaveTextContent(/if an account exists/i);
  });

  it("shows a helpful sign-in error", async () => {
    signInWithPassword.mockResolvedValue({ error: new Error("invalid credentials") });
    render(<EmailPasswordAuth next="/dashboard" />);
    await userEvent.type(screen.getByRole("textbox", { name: "Email address" }), "candidate@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in with email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/did not work/i);
  });
});
