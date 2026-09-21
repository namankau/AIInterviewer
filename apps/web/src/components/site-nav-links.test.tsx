import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: pathname }));

import { SiteNavLinks } from "@/components/site-nav-links";

describe("SiteNavLinks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers every primary destination", () => {
    pathname.mockReturnValue("/arena");
    render(<SiteNavLinks />);

    for (const name of ["Home", "Rounds", "Courses", "Arena", "Profile"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("marks the section you are in, including a page nested under it", () => {
    pathname.mockReturnValue("/courses/dsa/11-backtracking");
    render(<SiteNavLinks />);

    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Arena" })).not.toHaveAttribute("aria-current");
  });
});
