import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ArchitectureLab } from "@/components/courses/architecture-lab";
import { getArchitectureScenario } from "@/lib/architecture-lab/scenarios";

const scenario = getArchitectureScenario("url-shortener")!;

describe("ArchitectureLab", () => {
  it("exposes a named region, accessible zones, provenance, and three input methods", () => {
    render(<ArchitectureLab scenario={scenario} />);

    const region = screen.getByRole("region", { name: scenario.title });
    expect(region).toBeInTheDocument();
    expect(within(region).getByLabelText("Unplaced components")).toBeInTheDocument();
    expect(within(region).getByLabelText("Edge drop zone")).toBeInTheDocument();
    expect(within(region).getAllByRole("button", { name: /^drag /i })).toHaveLength(scenario.components.length);
    expect(within(region).getAllByRole("combobox")).toHaveLength(scenario.components.length);
    expect(within(region).getByText(/use the keyboard/i)).toBeInTheDocument();
    expect(within(region).getByText("System Design Primer")).toHaveAttribute("href", expect.stringMatching(/^https:/));
  });

  it("can be completed without dragging and accepts an alternate valid placement", async () => {
    const user = userEvent.setup();
    render(<ArchitectureLab scenario={scenario} />);

    await user.selectOptions(screen.getByRole("combobox", { name: /move redirect cache/i }), "service");
    await user.selectOptions(screen.getByRole("combobox", { name: /move link api/i }), "service");
    await user.selectOptions(screen.getByRole("combobox", { name: /move mapping store/i }), "data");
    await user.selectOptions(screen.getByRole("combobox", { name: /move click analytics worker/i }), "background");
    await user.click(screen.getByRole("button", { name: /check architecture/i }));

    expect(screen.getByText(scenario.successMessage)).toBeInTheDocument();
    expect(screen.getAllByText(/^Works:/)).toHaveLength(scenario.components.length);
  });

  it("explains wrong placements, announces moves, and resets the design", async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureLab scenario={scenario} />);

    const linkSelect = screen.getByRole("combobox", { name: /move link api/i });
    await user.selectOptions(linkSelect, "edge");
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(/link api moved to edge/i);

    await user.click(screen.getByRole("button", { name: /check architecture/i }));
    expect(screen.getByText(/request validation and link rules/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^reset$/i }));
    expect(screen.getByRole("combobox", { name: /move link api/i })).toHaveValue("unplaced");
    expect(screen.queryByText(/\d\/\d placed — review/i)).not.toBeInTheDocument();
  });

  it("keeps keyboard focus visible on drag handles and fallback controls", () => {
    render(<ArchitectureLab scenario={scenario} />);
    expect(screen.getByRole("button", { name: /drag redirect cache/i })).toHaveClass("focus-visible:ring-2");
    expect(screen.getByRole("combobox", { name: /move redirect cache/i })).toHaveClass("focus-visible:ring-2");
  });
});
