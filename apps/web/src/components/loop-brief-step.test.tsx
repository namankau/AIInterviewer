import type { LoopBrief, PrepPlan } from "@acemyinterview/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoopBriefStep } from "./loop-brief-step";

const fetchLoopBrief = vi.hoisted(() => vi.fn());
const fetchPrepPlan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  fetchLoopBrief,
  fetchPrepPlan,
  ApiRequestError: class ApiRequestError extends Error {},
}));

const sourcedBrief: LoopBrief = {
  company: {
    slug: "amazon",
    name: "Amazon",
    archetype: "global_product",
    archetypeLabel: "Global product company",
    archetypeInProse: "a global product company loop",
    archetypeConfidence: "recognised",
  },
  hasSources: true,
  sourcedStages: [
    {
      stageName: "Online assessment",
      roleFamily: "Backend Engineer",
      order: 1,
      format: "Online, 90 minutes",
      durationMinutes: 90,
      assesses: "Coding fundamentals",
      roundType: null,
      citations: [
        {
          title: "How we hire: SDE II",
          publisher: "Amazon",
          url: "https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep",
          year: 2024,
          origin: "employer",
        },
      ],
    },
  ],
  generalPattern: [
    { order: 1, stageName: "Recruiter screen", format: "Phone", assesses: "Motivation and fit", roundType: null },
  ],
  publicSourcePattern: null,
  bankCoverage: { questionCount: 23, roundTypes: [], bankUrl: "/questions/amazon" },
};

const publicSourcePattern: LoopBrief["publicSourcePattern"] = {
  claims: [
    { text: "Sagitec starts with an online aptitude test.", sourceIndexes: [0] },
    { text: "A technical panel and an HR round follow.", sourceIndexes: [0, 1] },
  ],
  sources: [
    { title: "example.org", url: "https://example.org/sagitec-hiring" },
    { title: "news.example", url: "https://news.example/sagitec" },
  ],
};

const unsourcedBrief: LoopBrief = {
  ...sourcedBrief,
  company: {
    ...sourcedBrief.company,
    slug: null,
    name: "Sagitec Solutions",
    archetype: "service_based_it",
    archetypeInProse: "a service-based IT loop",
    archetypeConfidence: "inferred",
  },
  hasSources: false,
  sourcedStages: [],
  publicSourcePattern,
};

const plan: PrepPlan = {
  items: [
    {
      roundType: "coding_practical",
      roundLabel: "Coding and practical problem solving",
      stageName: "Onsite coding",
      why: "This is how Amazon's own \"Onsite coding\" stage runs, from a source we've read.",
      focusAreas: ["approach", "edge cases", "complexity"],
      suggestedMinutes: 45,
      citations: [],
    },
  ],
  unsimulatedStages: [],
};

describe("LoopBriefStep", () => {
  beforeEach(() => {
    fetchLoopBrief.mockReset();
    fetchPrepPlan.mockReset();
  });

  it("shows sourced stages, labelled and cited, separately from the general pattern", async () => {
    fetchLoopBrief.mockResolvedValue(sourcedBrief);
    fetchPrepPlan.mockResolvedValue(plan);

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Online assessment")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /how we hire: sde ii/i })).toHaveAttribute(
      "href",
      "https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep",
    );
    expect(screen.getByText(/general pattern for a global product company loop/i)).toBeInTheDocument();
    expect(screen.getByText("Recruiter screen.")).toBeInTheDocument();
  });

  it("says the honesty caveat once for a company we only infer the archetype for", async () => {
    fetchLoopBrief.mockResolvedValue({
      ...sourcedBrief,
      company: { ...sourcedBrief.company, slug: null, name: "Salesforce", archetypeConfidence: "inferred" },
      hasSources: false,
      sourcedStages: [],
    });
    fetchPrepPlan.mockResolvedValue(plan);

    render(
      <LoopBriefStep
        companyName="Salesforce"
        roleTitle="Staff Software Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/we don't know salesforce specifically/i)).toBeInTheDocument(),
    );
    // Said exactly once — not again as a "no sourced account" paragraph, and the
    // general-pattern label stays a short section header, not a repeat of the sentence.
    expect(screen.getAllByText(/not a claim about this employer/i)).toHaveLength(1);
    expect(screen.queryByText(/we don't hold a sourced account/i)).not.toBeInTheDocument();
  });

  it("has no Question bank section", async () => {
    fetchLoopBrief.mockResolvedValue(sourcedBrief);
    fetchPrepPlan.mockResolvedValue(plan);

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Online assessment")).toBeInTheDocument());
    expect(screen.queryByText(/question bank/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /see them/i })).not.toBeInTheDocument();
  });

  it("folds a sourced stage with nothing to say into a quiet citation line, not its own block", async () => {
    fetchLoopBrief.mockResolvedValue({
      ...sourcedBrief,
      sourcedStages: [
        ...sourcedBrief.sourcedStages,
        {
          stageName: "First round interview",
          roleFamily: null,
          order: 2,
          format: null,
          durationMinutes: null,
          assesses: null,
          roundType: null,
          citations: [
            {
              title: "Interview Experience with Salesforce, 2025",
              publisher: "Prakash K (dev.to)",
              url: "https://dev.to/prakash/salesforce-interview",
              year: 2025,
              origin: "author",
            },
          ],
        },
      ],
    });
    fetchPrepPlan.mockResolvedValue(plan);

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Online assessment")).toBeInTheDocument());
    // Not its own labelled stage block...
    expect(screen.queryByText("First round interview")).not.toBeInTheDocument();
    // ...but the citation it carries is still there.
    expect(screen.getByText(/based in part on/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /interview experience with salesforce, 2025/i }),
    ).toHaveAttribute("href", "https://dev.to/prakash/salesforce-interview");
  });

  it("offers a way back to editing the description", async () => {
    fetchLoopBrief.mockResolvedValue(sourcedBrief);
    fetchPrepPlan.mockResolvedValue(plan);
    const onEdit = vi.fn();

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={onEdit}
      />,
    );

    await waitFor(() => expect(screen.getByText("Online assessment")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /edit the description/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("starts the plan's first round on the primary action", async () => {
    fetchLoopBrief.mockResolvedValue(sourcedBrief);
    fetchPrepPlan.mockResolvedValue(plan);
    const onChooseRound = vi.fn();

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={onChooseRound}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /start with coding/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /start with coding/i }));

    expect(onChooseRound).toHaveBeenCalledWith("coding_practical");
  });

  it("offers every other round type one click away", async () => {
    fetchLoopBrief.mockResolvedValue(sourcedBrief);
    fetchPrepPlan.mockResolvedValue(plan);
    const onChooseRound = vi.fn();

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={onChooseRound}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /system or solution design/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /system or solution design/i }));

    expect(onChooseRound).toHaveBeenCalledWith("system_design");
  });

  it("shows public-source research as its own AI-labelled section, every line linked to its pages", async () => {
    fetchLoopBrief.mockResolvedValue(unsourcedBrief);
    fetchPrepPlan.mockResolvedValue(plan);

    render(
      <LoopBriefStep
        companyName="Sagitec Solutions"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const section = await screen.findByRole("region", { name: /what public pages say about sagitec solutions/i });
    const scoped = within(section);
    expect(scoped.getByText("Found in public sources")).toBeInTheDocument();
    expect(scoped.getByText(/summarised by ai from a web search, not checked by us/i)).toBeInTheDocument();
    expect(scoped.getByText(/sagitec starts with an online aptitude test/i)).toBeInTheDocument();

    // Each claim carries its own numbered citations...
    expect(scoped.getAllByRole("link", { name: "Source 1: example.org" })).toHaveLength(2);
    expect(scoped.getByRole("link", { name: "Source 2: news.example" })).toHaveAttribute(
      "href",
      "https://news.example/sagitec",
    );
    // ...and the source list says what each number is, opening outside the app.
    const listed = scoped.getByRole("link", { name: "example.org" });
    expect(listed).toHaveAttribute("href", "https://example.org/sagitec-hiring");
    expect(listed).toHaveAttribute("target", "_blank");

    // Never styled as our own record, and the archetype pattern still follows, labelled.
    expect(screen.queryByText(/own record/i)).not.toBeInTheDocument();
    expect(screen.getByText(/general pattern for a service-based it loop/i)).toBeInTheDocument();
    // One caveat, and it is the one that names the search.
    expect(screen.getByText(/what a search of public pages found/i)).toBeInTheDocument();
    expect(screen.queryByText(/we don't know sagitec solutions specifically/i)).not.toBeInTheDocument();
  });

  it("does not show public research beside a sourced record, even if it arrives", async () => {
    fetchLoopBrief.mockResolvedValue({ ...sourcedBrief, publicSourcePattern });
    fetchPrepPlan.mockResolvedValue(plan);

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Online assessment")).toBeInTheDocument());
    expect(screen.queryByText("Found in public sources")).not.toBeInTheDocument();
    expect(screen.queryByText(/sagitec starts with/i)).not.toBeInTheDocument();
  });

  it("falls back to the archetype caveat when the search found nothing citable", async () => {
    fetchLoopBrief.mockResolvedValue({ ...unsourcedBrief, publicSourcePattern: null });
    fetchPrepPlan.mockResolvedValue(plan);

    render(
      <LoopBriefStep
        companyName="Sagitec Solutions"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/we don't know sagitec solutions specifically/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Found in public sources")).not.toBeInTheDocument();
  });

  it("states plainly when we hold no source for this company", async () => {
    fetchLoopBrief.mockResolvedValue({ ...sourcedBrief, hasSources: false, sourcedStages: [] });
    fetchPrepPlan.mockResolvedValue({ items: [], unsimulatedStages: [] });

    render(
      <LoopBriefStep
        companyName="Amazon"
        roleTitle="Backend Engineer"
        accessToken="token"
        onChooseRound={vi.fn()}
        onSkip={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/we don't hold a sourced account of amazon's process yet/i)).toBeInTheDocument(),
    );
  });
});
