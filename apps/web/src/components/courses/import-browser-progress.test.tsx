import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importCourseProgress = vi.hoisted(() => vi.fn());
const useAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  importCourseProgress,
  fetchCourseProgress: vi.fn().mockResolvedValue({ completed: {} }),
  markChapterComplete: vi.fn(),
  markChapterIncomplete: vi.fn(),
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken }));

import { ImportBrowserProgress, resetImportPrompt } from "@/components/courses/import-browser-progress";
import { COURSE_PROGRESS_KEY } from "@/lib/course-progress";

function seedBrowserProgress() {
  window.localStorage.setItem(
    COURSE_PROGRESS_KEY,
    JSON.stringify({ version: 1, completed: { java: ["one", "two"] } }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  resetImportPrompt();
  useAccessToken.mockReturnValue("token-abc");
  importCourseProgress.mockResolvedValue({ completed: { java: ["one", "two"] } });
});

describe("ImportBrowserProgress", () => {
  it("never imports silently — it asks first", async () => {
    seedBrowserProgress();
    render(<ImportBrowserProgress />);

    expect(await screen.findByText(/2 chapters marked complete in this browser/i)).toBeInTheDocument();
    expect(importCourseProgress).not.toHaveBeenCalled();
  });

  it("imports on request and then stops asking", async () => {
    seedBrowserProgress();
    const user = userEvent.setup();
    render(<ImportBrowserProgress />);

    await user.click(await screen.findByRole("button", { name: /add to my account/i }));

    expect(importCourseProgress).toHaveBeenCalledWith("token-abc", {
      chapters: [
        { courseSlug: "java", chapterSlug: "one" },
        { courseSlug: "java", chapterSlug: "two" },
      ],
    });
    await waitFor(() => expect(window.localStorage.getItem(COURSE_PROGRESS_KEY)).toBeNull());
  });

  it("discards without importing when the progress is not theirs", async () => {
    seedBrowserProgress();
    const user = userEvent.setup();
    render(<ImportBrowserProgress />);

    await user.click(await screen.findByRole("button", { name: /not mine/i }));

    expect(importCourseProgress).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(COURSE_PROGRESS_KEY)).toBeNull();
    expect(screen.queryByRole("button", { name: /add to my account/i })).toBeNull();
  });

  it("keeps the offer, and says so, when the import fails", async () => {
    seedBrowserProgress();
    importCourseProgress.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<ImportBrowserProgress />);

    await user.click(await screen.findByRole("button", { name: /add to my account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't save/i);
    expect(window.localStorage.getItem(COURSE_PROGRESS_KEY)).not.toBeNull();
  });

  it("shows nothing when this browser has no saved progress", () => {
    render(<ImportBrowserProgress />);
    expect(screen.queryByRole("button", { name: /add to my account/i })).toBeNull();
  });

  it("offers nothing for a leftover record that holds no chapters", () => {
    window.localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify({ version: 1, completed: { java: [] } }));
    render(<ImportBrowserProgress />);

    expect(screen.queryByRole("button", { name: /add to my account/i })).toBeNull();
  });
});
