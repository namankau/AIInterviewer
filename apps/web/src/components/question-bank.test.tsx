import type { BankCompany, BankQuestion } from "@acemyinterview/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { describeOrigin, monthYear } from "@/lib/question-bank";

import { CompanyQuestionsView } from "./company-questions";
import { QuestionBankIndexView } from "./question-bank-index";

const amazon = (over: Partial<BankCompany> = {}): BankCompany => ({
  slug: "amazon",
  name: "Amazon",
  archetype: "global_product",
  archetypeLabel: "Global product company",
  archetypeInProse: "a global product company loop",
  questionCount: 3,
  roundTypes: [
    { roundType: "system_design", count: 2 },
    { roundType: null, count: 1 },
  ],
  ...over,
});

const rateLimiter: BankQuestion = {
  id: "q1",
  text: "Design a rate limiter for a public API.",
  roundType: "system_design",
  tier: "published_source",
  corroboration: 2,
  lastReported: "2025-01-14",
  companies: [
    { slug: "amazon", name: "Amazon", corroboration: 2, lastReported: "2025-01-14" },
    { slug: "microsoft", name: "Microsoft", corroboration: 1, lastReported: null },
  ],
  citations: [
    { title: "How we hire", publisher: "Amazon", url: "https://amazon.jobs/how", year: 2024, origin: "employer" },
    { title: "My L5 loop", publisher: "Priya Rao", url: "https://priya.dev/l5", year: 2025, origin: "author" },
  ],
};

describe("QuestionBankIndexView", () => {
  it("lists each company with its count, linking to its page", () => {
    render(<QuestionBankIndexView companies={[amazon()]} />);

    const link = screen.getByRole("link", { name: "Amazon" });
    expect(link).toHaveAttribute("href", "/questions/amazon");
    expect(screen.getByText("3 questions")).toBeInTheDocument();
    expect(screen.getByText(/System or solution design 2/)).toBeInTheDocument();
  });

  it("groups companies under their initial, as an index", () => {
    render(
      <QuestionBankIndexView
        companies={[amazon(), amazon({ slug: "atlassian", name: "Atlassian" }), amazon({ slug: "zoho", name: "Zoho" })]}
      />,
    );

    const a = screen.getByRole("heading", { name: "A" });
    expect(a).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Z" })).toBeInTheDocument();
    const section = a.closest("section") as HTMLElement;
    expect(within(section).getAllByRole("link").map((l) => l.textContent)).toEqual(["Amazon", "Atlassian"]);
  });

  it("says plainly when nothing is sourced, rather than showing an empty list", () => {
    render(<QuestionBankIndexView companies={[]} />);

    expect(screen.getByRole("heading", { name: /nothing sourced yet/i })).toBeInTheDocument();
    expect(screen.getByText(/general patterns/i)).toBeInTheDocument();
  });
});

describe("CompanyQuestionsView", () => {
  const view = (props: Partial<Parameters<typeof CompanyQuestionsView>[0]> = {}) =>
    render(
      <CompanyQuestionsView company={amazon()} questions={[rateLimiter]} total={1} roundType={null} {...props} />,
    );

  /** The owner's example: browsing Amazon still shows the question also carries Microsoft. */
  it("shows every company a question is reported at, each linking to its page", () => {
    view();

    expect(screen.getByRole("link", { name: "Microsoft" })).toHaveAttribute("href", "/questions/microsoft");
    expect(screen.getByRole("link", { name: "Amazon", current: "page" })).toHaveAttribute("href", "/questions/amazon");
  });

  it("says how many sources report it and how recently", () => {
    view();

    expect(screen.getByText(/reported in 2 sources · last reported january 2025/i)).toBeInTheDocument();
  });

  it("says who each source is, so an employer's own page reads differently from one person's account", () => {
    view();

    const sources = screen.getByRole("list", { name: "Sources" });
    expect(within(sources).getByText("Amazon’s own site")).toBeInTheDocument();
    expect(within(sources).getByText("A published account by Priya Rao")).toBeInTheDocument();
    expect(within(sources).getByRole("link", { name: "My L5 loop" })).toHaveAttribute("href", "https://priya.dev/l5");
  });

  it("filters by round type, with the current filter announced as pressed", async () => {
    const onRoundType = vi.fn();
    view({ onRoundType });

    expect(screen.getByRole("button", { name: /all rounds/i })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /system or solution design/i }));

    expect(onRoundType).toHaveBeenCalledWith("system_design");
  });

  it("offers more only while there is more", async () => {
    const onLoadMore = vi.fn();
    const { unmount } = view({ total: 5, onLoadMore });
    await userEvent.click(screen.getByRole("button", { name: /show more \(4 left\)/i }));
    expect(onLoadMore).toHaveBeenCalled();
    unmount();

    view({ total: 1 });
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  /** The honest empty state: no invented questions, and the general-pattern round named. */
  it("for a company with nothing sourced, says rounds run on its archetype's general patterns", () => {
    view({
      company: amazon({ slug: "nvidia", name: "Nvidia", questionCount: 0, roundTypes: [] }),
      questions: [],
      total: 0,
    });

    expect(screen.getByRole("heading", { name: /nothing sourced for nvidia yet/i })).toBeInTheDocument();
    expect(screen.getByText(/general patterns for a global product company loop/i)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /filter by round/i })).not.toBeInTheDocument();
  });
});

describe("question bank wording", () => {
  it("describes each origin, and a legacy source without one", () => {
    const base = { title: "t", url: null, year: null };
    expect(describeOrigin({ ...base, publisher: "Google", origin: "employer" })).toBe("Google’s own site");
    expect(describeOrigin({ ...base, publisher: "GitHub user x", origin: "open_licence" })).toBe(
      "An openly licensed document from GitHub user x",
    );
    expect(describeOrigin({ ...base, publisher: null, origin: null })).toBe("A source in our library");
  });

  it("dates by month and year only, and never invents one", () => {
    expect(monthYear("2024-03-09")).toBe("March 2024");
    expect(monthYear(null)).toBeNull();
  });
});
