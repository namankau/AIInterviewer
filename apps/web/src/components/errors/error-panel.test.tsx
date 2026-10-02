import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorPanel } from "./error-panel";

describe("ErrorPanel", () => {
  it("offers a retry and a way out", async () => {
    const onRetry = vi.fn();
    render(<ErrorPanel title="This page didn't load" body="Trying again usually works." onRetry={onRetry} />);

    expect(screen.getByRole("heading", { level: 1, name: "This page didn't load" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /go to your dashboard/i })).toHaveAttribute("href", "/dashboard");
  });

  it("shows no retry when there is nothing to retry", () => {
    render(<ErrorPanel title="We couldn't find that page" body="The link may be out of date." />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
