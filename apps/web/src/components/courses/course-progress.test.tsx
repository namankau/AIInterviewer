import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchCourseProgress = vi.hoisted(() => vi.fn());
const markChapterComplete = vi.hoisted(() => vi.fn());
const markChapterIncomplete = vi.hoisted(() => vi.fn());
const useAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  fetchCourseProgress,
  markChapterComplete,
  markChapterIncomplete,
  importCourseProgress: vi.fn(),
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken }));

import {
  ChapterDoneMark,
  CourseHeroProgress,
  MarkCompleteButton,
  ModuleProgress,
} from "@/components/courses/course-progress";
import { GuidedLessonControls } from "@/components/courses/guided-lesson-controls";
import { resetCourseProgress } from "@/lib/use-course-progress";

const chapters = [
  { slug: "one", title: "First steps" },
  { slug: "two", title: "Second steps" },
  { slug: "three", title: "Third steps" },
];

const guidedBeats = [
  { key: "see" as const, label: "See the idea", shortLabel: "See it", description: "See", itemCount: 1, content: <p>See</p> },
  { key: "predict" as const, label: "Take a first guess", shortLabel: "Predict", description: "Predict", itemCount: 1, content: <p>Predict</p> },
  { key: "interact" as const, label: "Try it yourself", shortLabel: "Try it", description: "Try", itemCount: 1, content: <p>Try</p> },
  { key: "explain" as const, label: "Explain and remember", shortLabel: "Remember", description: "Remember", itemCount: 1, content: <p>Remember</p> },
  { key: "check" as const, label: "Final checkpoint", shortLabel: "Check", description: "Check", itemCount: 1, content: <p>Check</p> },
];

async function visitRemainingBeats(user: ReturnType<typeof userEvent.setup>) {
  for (const beat of guidedBeats.slice(1)) {
    await user.click(screen.getByRole("button", { name: beat.label }));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCourseProgress();
  useAccessToken.mockReturnValue("token-abc");
  fetchCourseProgress.mockResolvedValue({ completed: {} });
  markChapterComplete.mockResolvedValue(undefined);
  markChapterIncomplete.mockResolvedValue(undefined);
});

describe("MarkCompleteButton", () => {
  it("unlocks only after the learner has visited every guided beat", async () => {
    const user = userEvent.setup();
    render(
      <GuidedLessonControls
        beats={guidedBeats}
        completion={<MarkCompleteButton courseSlug="java" chapterSlug="one" />}
      />,
    );

    const locked = await screen.findByRole("button", { name: /visit all lesson beats/i });
    await waitFor(() => expect(fetchCourseProgress).toHaveBeenCalled());
    expect(locked).toBeDisabled();
    expect(screen.getByText(/1 of 5 beats explored/i)).toBeInTheDocument();

    await visitRemainingBeats(user);

    expect(screen.getByText(/explored every beat/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark chapter as complete/i })).toBeEnabled();
  });

  it("lets a learner undo an existing completion without revisiting every beat", async () => {
    fetchCourseProgress.mockResolvedValue({ completed: { java: ["one"] } });
    render(
      <GuidedLessonControls
        beats={guidedBeats}
        completion={<MarkCompleteButton courseSlug="java" chapterSlug="one" />}
      />,
    );

    const button = await screen.findByRole("button", { name: /completed/i });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("allows a save retry after the initial progress read fails", async () => {
    fetchCourseProgress.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(
      <GuidedLessonControls
        beats={guidedBeats}
        completion={<MarkCompleteButton courseSlug="java" chapterSlug="one" />}
      />,
    );

    await visitRemainingBeats(user);
    const button = await screen.findByRole("button", { name: /mark chapter as complete/i });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByText(/saved progress could not be loaded/i)).toBeInTheDocument();

    await user.click(button);

    expect(markChapterComplete).toHaveBeenCalledWith("token-abc", "java", "one");
    expect(await screen.findByRole("button", { name: /completed/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves the tick to the account and reflects it", async () => {
    const user = userEvent.setup();
    render(<MarkCompleteButton courseSlug="java" chapterSlug="one" />);

    const button = await screen.findByRole("button", { name: /mark chapter as complete/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(markChapterComplete).toHaveBeenCalledWith("token-abc", "java", "one");
    expect(await screen.findByRole("button", { name: /completed/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("un-ticks by deleting, not by writing a false", async () => {
    fetchCourseProgress.mockResolvedValue({ completed: { java: ["one"] } });
    const user = userEvent.setup();
    render(<MarkCompleteButton courseSlug="java" chapterSlug="one" />);

    const button = await screen.findByRole("button", { name: /completed/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(markChapterIncomplete).toHaveBeenCalledWith("token-abc", "java", "one");
  });

  it("reverts the tick and says so when the save fails", async () => {
    markChapterComplete.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<MarkCompleteButton courseSlug="java" chapterSlug="one" />);

    const button = await screen.findByRole("button", { name: /mark chapter as complete/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't save/i);
    expect(screen.getByRole("button", { name: /mark chapter as complete/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not mark a chapter complete just because it was rendered", async () => {
    render(<MarkCompleteButton courseSlug="java" chapterSlug="one" />);
    await waitFor(() => expect(fetchCourseProgress).toHaveBeenCalled());

    expect(markChapterComplete).not.toHaveBeenCalled();
  });
});

describe("shared progress across components", () => {
  it("ticking a chapter updates the row mark, module count and hero together", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CourseHeroProgress courseSlug="java" chapters={chapters} />
        <ModuleProgress courseSlug="java" chapterSlugs={["one", "two", "three"]} />
        <ChapterDoneMark courseSlug="java" chapterSlug="one" />
        <MarkCompleteButton courseSlug="java" chapterSlug="one" />
      </>,
    );

    const button = await screen.findByRole("button", { name: /mark chapter as complete/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 done/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("link", { name: /continue learning/i })).toHaveAttribute("href", "/courses/java/two");
  });

  it("keeps two courses' progress separate", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MarkCompleteButton courseSlug="java" chapterSlug="one" />
        <ChapterDoneMark courseSlug="dsa" chapterSlug="one" />
      </>,
    );

    const button = await screen.findByRole("button", { name: /mark chapter as complete/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByText("Not completed")).toBeInTheDocument();
  });
});

describe("CourseHeroProgress", () => {
  it("resumes at the first unfinished chapter", async () => {
    fetchCourseProgress.mockResolvedValue({ completed: { java: ["one"] } });
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    expect(await screen.findByRole("link", { name: /continue learning/i })).toHaveAttribute(
      "href",
      "/courses/java/two",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 3 chapters complete");
  });

  it("offers a review once everything is complete", async () => {
    fetchCourseProgress.mockResolvedValue({ completed: { java: ["one", "two", "three"] } });
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    expect(await screen.findByRole("link", { name: /review from the start/i })).toHaveAttribute(
      "href",
      "/courses/java/one",
    );
    expect(screen.getByText(/every chapter complete/i)).toBeInTheDocument();
  });

  it("does not claim a course is unstarted while progress is still loading", () => {
    fetchCourseProgress.mockReturnValue(new Promise(() => {}));
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("link", { name: /continue learning/i })).toBeNull();
  });

  it("shows no progress, rather than a wrong zero, when the read fails", async () => {
    fetchCourseProgress.mockRejectedValue(new Error("offline"));
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    expect(await screen.findByRole("link", { name: /start course/i })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("does not read progress at all for a signed-out visitor", async () => {
    useAccessToken.mockReturnValue(null);
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    await waitFor(() => expect(fetchCourseProgress).not.toHaveBeenCalled());
  });
});
