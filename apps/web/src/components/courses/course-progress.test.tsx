import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ChapterDoneMark,
  CourseHeroProgress,
  MarkCompleteButton,
  ModuleProgress,
} from "@/components/courses/course-progress";
import { COURSE_PROGRESS_KEY } from "@/lib/course-progress";

const chapters = [
  { slug: "one", title: "First steps" },
  { slug: "two", title: "Second steps" },
  { slug: "three", title: "Third steps" },
];

beforeEach(() => window.localStorage.clear());

describe("MarkCompleteButton", () => {
  it("toggles, announces its state, and persists", async () => {
    const user = userEvent.setup();
    render(<MarkCompleteButton courseSlug="java" chapterSlug="one" />);

    const button = screen.getByRole("button", { name: /mark chapter as complete/i });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(screen.getByRole("button", { name: /completed/i })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem(COURSE_PROGRESS_KEY) ?? "{}").completed.java).toEqual(["one"]);

    await user.click(screen.getByRole("button", { name: /completed/i }));
    expect(screen.getByRole("button", { name: /mark chapter as complete/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not consider a chapter complete just because it was rendered", () => {
    render(<MarkCompleteButton courseSlug="java" chapterSlug="one" />);
    expect(window.localStorage.getItem(COURSE_PROGRESS_KEY)).toBeNull();
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

    expect(screen.getByRole("link", { name: /start course/i })).toHaveAttribute("href", "/courses/java/one");
    expect(screen.getByText("Not completed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mark chapter as complete/i }));

    expect(screen.getByText("Completed")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /mark chapter as complete/i }));
    expect(screen.getByText("Not completed")).toBeInTheDocument();
  });
});

describe("CourseHeroProgress", () => {
  it("resumes at the first unfinished chapter and shows the bar only once started", () => {
    window.localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify({ version: 1, completed: { java: ["one"] } }));
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 3 chapters complete");
    expect(screen.getByRole("link", { name: /continue learning/i })).toHaveAttribute("href", "/courses/java/two");
  });

  it("offers a review once everything is complete", () => {
    window.localStorage.setItem(
      COURSE_PROGRESS_KEY,
      JSON.stringify({ version: 1, completed: { java: ["one", "two", "three"] } }),
    );
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    expect(screen.getByRole("link", { name: /review from the start/i })).toHaveAttribute("href", "/courses/java/one");
    expect(screen.getByText(/every chapter complete/i)).toBeInTheDocument();
  });

  it("renders sensibly when stored progress is corrupt", () => {
    window.localStorage.setItem(COURSE_PROGRESS_KEY, "{{{ not json");
    render(<CourseHeroProgress courseSlug="java" chapters={chapters} />);

    expect(screen.getByRole("link", { name: /start course/i })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
