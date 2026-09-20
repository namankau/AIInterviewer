import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VizBlock } from "@/components/courses/viz-block";
import type { Block } from "@/content/courses/types";

type VizBlockData = Extract<Block, { kind: "viz" }>;

const arrayViz: VizBlockData = {
  kind: "viz",
  title: "Two pointers closing in",
  caption: "A short walk-through.",
  viz: {
    type: "array",
    frames: [
      { cells: [{ value: 2 }, { value: 7 }, { value: 4 }], note: "Frame one: nothing moved yet." },
      { cells: [{ value: 2, pointers: ["left"] }, { value: 7 }, { value: 4, pointers: ["right"] }], note: "Frame two: pointers set." },
      { cells: [{ value: 2 }, { value: 7, pointers: ["left", "right"] }, { value: 4 }], note: "Frame three: pointers meet." },
    ],
  },
};

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("VizBlock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders frame 0's note and diagram up front", () => {
    setMatchMedia(false);
    render(<VizBlock block={arrayViz} />);

    expect(screen.getByText("Frame one: nothing moved yet.")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("moving to the next frame changes the announced note", async () => {
    setMatchMedia(false);
    const user = userEvent.setup();
    render(<VizBlock block={arrayViz} />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("status")).toHaveTextContent("Frame two: pointers set.");
  });

  it("previous is disabled on frame 0 and next is disabled on the last frame", async () => {
    setMatchMedia(false);
    const user = userEvent.setup();
    render(<VizBlock block={arrayViz} />);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Frame three: pointers meet.");
  });

  it("reset returns to frame 0", async () => {
    setMatchMedia(false);
    const user = userEvent.setup();
    render(<VizBlock block={arrayViz} />);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByRole("status")).toHaveTextContent("Frame one: nothing moved yet.");
  });

  it("the step slider has an accessible name and moves the frame directly", () => {
    setMatchMedia(false);
    render(<VizBlock block={arrayViz} />);

    const slider = screen.getByRole("slider", { name: /step 1 of 3/i });
    expect(slider).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "1" } });

    expect(screen.getByRole("status")).toHaveTextContent("Frame two: pointers set.");
  });

  it("offers no play control when the reader prefers reduced motion", () => {
    setMatchMedia(true);
    render(<VizBlock block={arrayViz} />);

    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
  });

  it("offers a play control when motion is not reduced", () => {
    setMatchMedia(false);
    render(<VizBlock block={arrayViz} />);

    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});
