import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no real <canvas>; canvas-confetti's animation loop would otherwise throw
// asynchronously after a "perfect run" or new-badge test finishes. celebrate.test.ts
// already covers the reduced-motion gating on this module in isolation.
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import { ArenaSession } from "@/components/arena/arena-session";
import type { Challenge } from "@/lib/arena/types";

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

const challenges: Challenge[] = [
  {
    id: "c1",
    kind: "mcq",
    courseSlug: "dsa",
    chapterSlug: "arrays-in-memory",
    moduleTitle: "Foundations",
    prompt: "Question one?",
    options: ["Alpha", "Beta", "Gamma"],
    correctIndex: 1,
    why: "Beta is right because of reasons.",
  },
  {
    id: "c2",
    kind: "mcq",
    courseSlug: "dsa",
    chapterSlug: "two-pointers",
    moduleTitle: "Foundations",
    prompt: "Question two?",
    options: ["Delta", "Epsilon"],
    correctIndex: 0,
    why: "Delta is right because of other reasons.",
  },
];

/** The pool is small enough, and shuffled, that either challenge can come up first —
 * this finds whichever one is showing right now rather than assuming an order. */
function currentChallenge(): Challenge {
  const heading = screen.getByRole("heading", { level: 2 });
  const found = challenges.find((c) => c.prompt === heading.textContent);
  if (!found) throw new Error(`No fixture challenge matches heading "${heading.textContent}"`);
  return found;
}

async function answerCurrent(user: UserEvent, correct: boolean) {
  const challenge = currentChallenge();
  const optionIndex = correct ? challenge.correctIndex : (challenge.correctIndex + 1) % challenge.options.length;
  const optionText = challenge.options[optionIndex]!;
  await user.click(screen.getByRole("button", { name: new RegExp(`^${optionIndex + 1}${optionText}$`) }));
  await user.keyboard("{Enter}");
}

describe("ArenaSession", () => {
  beforeEach(() => {
    setMatchMedia(false);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a challenge's prompt and options", () => {
    render(<ArenaSession challenges={[challenges[0]!]} />);
    expect(screen.getByText("Question one?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("selecting the correct option and confirming with Enter shows feedback naming it correct", async () => {
    const user = userEvent.setup();
    render(<ArenaSession challenges={[challenges[0]!]} />);

    const correctButton = screen.getByRole("button", { name: /Beta/ });
    await user.click(correctButton);
    expect(correctButton).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("status")).toHaveTextContent(/Correct/);
    expect(screen.getByText(/Beta is right because of reasons\./)).toBeInTheDocument();
  });

  it("a number key selects the option in that position", async () => {
    const user = userEvent.setup();
    render(<ArenaSession challenges={[challenges[0]!]} />);

    await user.keyboard("2"); // position 2 = "Beta", the correct one
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("an incorrect pick is announced as such, not just shown in colour", async () => {
    const user = userEvent.setup();
    render(<ArenaSession challenges={[challenges[0]!]} />);

    await user.click(screen.getByRole("button", { name: /Alpha/ })); // wrong
    await user.keyboard("{Enter}");
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/Not quite/);
  });

  it("pressing Enter again after feedback advances to the next challenge and moves focus to it", async () => {
    const user = userEvent.setup();
    render(<ArenaSession challenges={challenges} />);

    await answerCurrent(user, true);
    await screen.findByRole("status");
    const firstHeadingText = screen.getByRole("heading", { level: 2 }).textContent;
    await user.keyboard("{Enter}");

    await waitFor(() => {
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading.textContent).not.toBe(firstHeadingText);
      expect(heading).toHaveFocus();
    });
  });

  it("completing every challenge shows a result screen with the correct count", async () => {
    const user = userEvent.setup();
    render(<ArenaSession challenges={challenges} />);

    await answerCurrent(user, true);
    await screen.findByRole("status");
    await user.keyboard("{Enter}");

    await answerCurrent(user, true);
    await screen.findByRole("status");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Run complete")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 correct")).toBeInTheDocument();
    expect(screen.getByText(/Everything in this run, correct/)).toBeInTheDocument();
  });

  it("links a wrong answer's result to the chapter that teaches it", async () => {
    const user = userEvent.setup();
    render(<ArenaSession challenges={challenges} />);

    const first = currentChallenge();
    await answerCurrent(user, false);
    await screen.findByRole("status");
    await user.keyboard("{Enter}");

    await answerCurrent(user, false);
    await screen.findByRole("status");
    await user.keyboard("{Enter}");

    await screen.findByText("Run complete");
    const link = screen.getByRole("link", { name: new RegExp(first.chapterSlug) });
    expect(link).toHaveAttribute("href", `/courses/${first.courseSlug}/${first.chapterSlug}`);
  });
});
