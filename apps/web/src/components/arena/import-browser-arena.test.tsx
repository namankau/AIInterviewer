import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importArenaProgress = vi.hoisted(() => vi.fn());
const useAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  importArenaProgress,
  fetchArenaProgress: vi.fn().mockResolvedValue({
    xp: 0,
    streak: { current: 0, longest: 0, lastActiveDate: null },
    badges: [],
    cards: {},
    masteredChallengeIds: [],
  }),
  recordArenaAnswer: vi.fn(),
  awardArenaBadges: vi.fn(),
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken }));

import {
  ImportBrowserArenaProgress,
  resetArenaImportPrompt,
} from "@/components/arena/import-browser-arena";
import { ARENA_STORAGE_KEY } from "@/lib/arena/storage";

const card = {
  due: "2026-09-22T10:00:00.000Z",
  stability: 3.5,
  difficulty: 5.1,
  scheduledDays: 1,
  learningSteps: 0,
  reps: 2,
  lapses: 0,
  state: 2,
  lastReview: "2026-09-21T10:00:00.000Z",
};

function seed() {
  window.localStorage.setItem(
    ARENA_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      xp: 120,
      streak: { current: 3, longest: 9, lastActiveDate: "2026-09-21" },
      badges: ["streak-7"],
      cards: { c1: card, c2: card },
      masteredChallengeIds: ["c1"],
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  resetArenaImportPrompt();
  useAccessToken.mockReturnValue("token-abc");
  importArenaProgress.mockResolvedValue({
    xp: 120,
    streak: { current: 3, longest: 9, lastActiveDate: "2026-09-21" },
    badges: ["streak-7"],
    cards: {},
    masteredChallengeIds: [],
  });
});

describe("ImportBrowserArenaProgress", () => {
  it("never imports silently — it asks first", async () => {
    seed();
    render(<ImportBrowserArenaProgress />);

    expect(await screen.findByText(/120 XP and 2 answered challenges/i)).toBeInTheDocument();
    expect(importArenaProgress).not.toHaveBeenCalled();
  });

  it("imports XP, streak, badges and cards, carrying mastery across", async () => {
    seed();
    const user = userEvent.setup();
    render(<ImportBrowserArenaProgress />);

    await user.click(await screen.findByRole("button", { name: /add to my account/i }));

    await waitFor(() => expect(importArenaProgress).toHaveBeenCalledTimes(1));
    const [, body] = importArenaProgress.mock.calls[0]!;
    expect(body.xp).toBe(120);
    expect(body.streakCurrent).toBe(3);
    expect(body.streakLongest).toBe(9);
    expect(body.lastActiveDate).toBe("2026-09-21");
    expect(body.badgeIds).toEqual(["streak-7"]);
    expect(body.cards).toHaveLength(2);
    expect(body.cards.find((c: { challengeId: string }) => c.challengeId === "c1")!.mastered).toBe(true);
    expect(body.cards.find((c: { challengeId: string }) => c.challengeId === "c2")!.mastered).toBe(false);
    await waitFor(() => expect(window.localStorage.getItem(ARENA_STORAGE_KEY)).toBeNull());
  });

  it("discards without importing when the progress is not theirs", async () => {
    seed();
    const user = userEvent.setup();
    render(<ImportBrowserArenaProgress />);

    await user.click(await screen.findByRole("button", { name: /not mine/i }));

    expect(importArenaProgress).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(ARENA_STORAGE_KEY)).toBeNull();
  });

  it("keeps the offer, and says so, when the import fails", async () => {
    seed();
    importArenaProgress.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<ImportBrowserArenaProgress />);

    await user.click(await screen.findByRole("button", { name: /add to my account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't save/i);
    expect(window.localStorage.getItem(ARENA_STORAGE_KEY)).not.toBeNull();
  });

  it("offers nothing when this browser holds no Arena progress", () => {
    render(<ImportBrowserArenaProgress />);
    expect(screen.queryByRole("button", { name: /add to my account/i })).toBeNull();
  });

  it("offers nothing for a record with no XP and no answered challenges", () => {
    window.localStorage.setItem(
      ARENA_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        xp: 0,
        streak: { current: 0, longest: 0, lastActiveDate: null },
        badges: [],
        cards: {},
        masteredChallengeIds: [],
      }),
    );
    render(<ImportBrowserArenaProgress />);

    expect(screen.queryByRole("button", { name: /add to my account/i })).toBeNull();
  });
});
