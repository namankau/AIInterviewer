import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "./session";

const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function signedIn() {
  getUser.mockResolvedValue({ data: { user: { id: "6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11" } } });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a signed-out visitor from the dashboard to sign in", async () => {
    signedOut();

    const response = await updateSession(requestFor("/dashboard"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("sends a signed-out visitor from a company's questions to sign in", async () => {
    signedOut();

    const response = await updateSession(requestFor("/questions/amazon"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/questions/amazon");
  });

  it("lets a signed-in candidate through to the dashboard", async () => {
    signedIn();

    const response = await updateSession(requestFor("/dashboard"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("sends a signed-in candidate away from the sign-in page", async () => {
    signedIn();

    const response = await updateSession(requestFor("/login"));

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/dashboard");
  });

  it("leaves the public landing page reachable either way", async () => {
    signedOut();
    expect((await updateSession(requestFor("/"))).headers.get("location")).toBeNull();

    signedIn();
    expect((await updateSession(requestFor("/"))).headers.get("location")).toBeNull();
  });
});
