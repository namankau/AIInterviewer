import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { TurnstileChallenge } from "./turnstile-challenge";

vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady: () => void }) => (
    <button type="button" onClick={onReady}>Load challenge script</button>
  ),
}));

afterEach(() => {
  delete window.turnstile;
});

it("passes a solved token and invalidates it on expiry and removal", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  const onToken = vi.fn();
  const remove = vi.fn();
  const renderWidget = vi.fn((container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => {
    expect(container).toBeInstanceOf(HTMLElement);
    expect(options.sitekey).toBe("public-key");
    return "widget-1";
  });
  window.turnstile = { render: renderWidget, remove };

  const view = render(<TurnstileChallenge siteKey="public-key" onToken={onToken} />);
  await user.click(screen.getByRole("button", { name: "Load challenge script" }));
  expect(renderWidget).toHaveBeenCalledTimes(1);
  const options = renderWidget.mock.calls[0]?.[1];
  expect(options?.sitekey).toBe("public-key");
  options?.callback("verified-token");
  expect(onToken).toHaveBeenCalledWith("verified-token");
  options?.["expired-callback"]();
  expect(onToken).toHaveBeenLastCalledWith(null);

  view.unmount();
  expect(remove).toHaveBeenCalledWith("widget-1");
});
