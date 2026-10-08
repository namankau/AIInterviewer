import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchCourseProgress = vi.hoisted(() => vi.fn());
const useAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  fetchCourseProgress,
  importCourseProgress: vi.fn(),
  markChapterComplete: vi.fn(),
  markChapterIncomplete: vi.fn(),
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken }));

import { CourseToc } from "@/components/courses/course-toc";
import { resetCourseProgress } from "@/lib/use-course-progress";

const course = {
  slug: "java",
  title: "Java Foundations",
  modules: [
    {
      title: "Start here",
      chapters: [
        { slug: "first", title: "First chapter" },
        { slug: "second", title: "Second chapter" },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  resetCourseProgress();
  useAccessToken.mockReturnValue("token-abc");
  fetchCourseProgress.mockResolvedValue({ completed: { java: ["first"] } });
});

describe("CourseToc", () => {
  it("presents the course as a navigable syllabus with current and completed states", async () => {
    render(<CourseToc course={course} currentSlug="second" />);

    expect(screen.getByRole("navigation", { name: "Chapters" })).toBeInTheDocument();
    expect(screen.getByText("Java Foundations")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Second chapter" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "1"));
    expect(screen.getByRole("link", { name: /completed.*first chapter/i })).toHaveAttribute(
      "href",
      "/courses/java/first",
    );
    expect(screen.getByText("1 of 2 chapters complete")).toBeInTheDocument();
  });
});
