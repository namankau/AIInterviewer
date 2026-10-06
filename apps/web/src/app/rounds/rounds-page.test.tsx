import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import RoundsPage from "./page";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => children,
}));

describe("RoundsPage", () => {
  it("links every round to a preselected mock interview", () => {
    render(<RoundsPage />);

    expect(screen.getAllByRole("link", { name: /Practise the .* round/ })).toHaveLength(10);
    expect(
      screen.getByRole("link", { name: "Practise the System or solution design round" }),
    ).toHaveAttribute("href", "/interview/new?round=system_design");
    expect(screen.getByRole("link", { name: "Practise the Custom topic round" })).toHaveAttribute(
      "href",
      "/interview/new?round=custom_topic",
    );
  });
});
