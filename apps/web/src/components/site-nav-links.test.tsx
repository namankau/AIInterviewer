import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: pathname }));

import { SiteNavLinks } from "@/components/site-nav-links";

describe("SiteNavLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of [
      "NEXT_PUBLIC_FEATURE_MOCK_INTERVIEWS",
      "NEXT_PUBLIC_FEATURE_COURSES",
      "NEXT_PUBLIC_FEATURE_ARENA",
      "NEXT_PUBLIC_FEATURE_REPORTS",
    ]) {
      vi.stubEnv(name, "true");
    }
  });
  afterEach(() => vi.unstubAllEnvs());

  it("offers every primary destination", () => {
    pathname.mockReturnValue("/arena");
    render(<SiteNavLinks />);

    for (const name of ["Dashboard", "Courses", "Mock interviews", "Arena"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "My reports" })).not.toBeInTheDocument();
  });

  it("marks the section you are in, including a page nested under it", () => {
    pathname.mockReturnValue("/courses/dsa/11-backtracking");
    render(<SiteNavLinks />);

    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Arena" })).not.toHaveAttribute("aria-current");
  });

  it("removes a disabled feature from navigation", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_ARENA", "false");
    pathname.mockReturnValue("/dashboard");
    render(<SiteNavLinks />);

    expect(screen.queryByRole("link", { name: "Arena" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Courses" })).toBeInTheDocument();
  });
});
