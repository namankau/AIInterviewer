import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError, fetchMe, updateProfile } from "@/lib/api";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const fetchMock = vi.fn();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("API reads that fail in transit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("repeats a read after a dropped connection and returns the answer", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(json(200, { id: "me" }));

    const result = fetchMe({ accessToken: "token" });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ id: "me" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("repeats a read the gateway could not answer", async () => {
    fetchMock.mockResolvedValueOnce(json(503, {})).mockResolvedValueOnce(json(200, { id: "me" }));

    const result = fetchMe({ accessToken: "token" });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ id: "me" });
  });

  it("gives up after three attempts and reports the last failure", async () => {
    fetchMock.mockResolvedValue(json(503, { error: "unavailable", message: "Down." }));

    const result = fetchMe({ accessToken: "token" }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();

    const error = await result;
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not repeat an answer the API actually gave", async () => {
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized", message: "Sign in." }));

    await expect(fetchMe({ accessToken: "token" })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never repeats a write", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(updateProfile("token", {} as never)).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
