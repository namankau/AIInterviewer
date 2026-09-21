import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumbs } from "@/components/breadcrumbs";

describe("Breadcrumbs", () => {
  it("offers a back link to the nearest parent, not the page itself", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "home", href: "/dashboard" },
          { label: "arena", href: "/arena" },
          { label: "java" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /back to arena/i })).toHaveAttribute("href", "/arena");
  });

  it("marks the current page and links every ancestor", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "courses", href: "/courses" },
          { label: "java", href: "/courses/java" },
          { label: "your first program" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(nav).getByText("your first program")).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "java" })).toHaveAttribute("href", "/courses/java");
  });

  it("shows no back link when there is no parent to go back to", () => {
    render(<Breadcrumbs items={[{ label: "arena" }]} />);

    expect(screen.queryByRole("link", { name: /back to/i })).toBeNull();
  });
});
