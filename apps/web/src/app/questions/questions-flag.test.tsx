import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RailNav } from "@/components/rail-nav";

import CompanyQuestionsPage from "./[slug]/page";
import QuestionsPage from "./page";

/**
 * `/questions` behind `NEXT_PUBLIC_QUESTION_BANK_BROWSABLE` (task 042): off by default, and
 * off means a 404 from both pages and no entry in the rail — not a redirect, not an empty
 * page. On, everything is as it was.
 */
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({
  notFound,
  usePathname: () => "/dashboard",
}));

// The pages' contents are tested elsewhere (`question-bank.test.tsx`); here only whether they render at all.
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/question-bank-index", () => ({ QuestionBankIndex: () => null }));
vi.mock("@/components/company-questions", () => ({ CompanyQuestions: () => null }));

const params = Promise.resolve({ slug: "amazon" });

describe("/questions while the bank is not browsable", () => {
  beforeEach(() => {
    notFound.mockClear();
  });

  it("is not found, index and company page alike", async () => {
    expect(() => QuestionsPage()).toThrow("NEXT_NOT_FOUND");
    await expect(CompanyQuestionsPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(2);
  });

  it("has no entry in the rail", () => {
    render(<RailNav />);

    expect(screen.queryByRole("link", { name: "Questions" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rounds" })).toBeInTheDocument();
  });
});

describe("/questions while the bank is browsable", () => {
  beforeEach(() => {
    notFound.mockClear();
    vi.stubEnv("NEXT_PUBLIC_QUESTION_BANK_BROWSABLE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders both pages", async () => {
    expect(QuestionsPage()).toBeTruthy();
    expect(await CompanyQuestionsPage({ params })).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("has its entry in the rail", () => {
    render(<RailNav />);

    expect(screen.getByRole("link", { name: "Questions" })).toHaveAttribute("href", "/questions");
  });
});
