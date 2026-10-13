import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CourseCatalogue, type CatalogueCourse } from "@/components/courses/course-catalogue";

vi.mock("@/components/courses/course-progress", () => ({ CourseCardProgress: () => null }));

const courses: CatalogueCourse[] = [
  { slug: "dsa", title: "Data Structures & Algorithms", tagline: "Patterns for coding rounds", level: "Beginner", chapterCount: 2, chapters: [], searchText: "data structures algorithms patterns for coding rounds arrays hashing recursion" },
  { slug: "ai-agents", title: "AI and Agentic AI", tagline: "Build reliable agents", level: "Beginner", chapterCount: 2, chapters: [], searchText: "ai agentic ai build reliable agents prompting tools" },
];

describe("CourseCatalogue", () => {
  it("finds concepts inside chapters and combines search with category filters", async () => {
    const user = userEvent.setup();
    render(<CourseCatalogue courses={courses} />);

    const search = screen.getByRole("searchbox", { name: "Search courses and concepts" });
    await user.type(search, "hashing");
    expect(screen.getByRole("link", { name: /Data Structures & Algorithms/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /AI and Agentic AI/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "AI" }));
    expect(screen.getByText("No courses found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
