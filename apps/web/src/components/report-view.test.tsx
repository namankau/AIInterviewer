import type { SessionReport } from "@acemyinterview/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportDocument } from "./report-view";

/**
 * A full, realistic report. Every quote below is something the fixture "said" — the same
 * discipline the server holds in production, where a score or an assessed area with no
 * evidence in the transcript is dropped before it reaches this component.
 */
function buildReport(overrides: Partial<SessionReport> = {}): SessionReport {
  return {
    sessionId: "session-1",
    companyName: "Flipkart",
    roleTitle: "Backend Engineer",
    roundType: "coding_practical",
    roundLabel: "Technical round",
    archetypeLabel: "Product company",
    answeredTurns: 5,
    generatedAt: "2026-09-01T10:00:00Z",
    headline: "A solid technical round with one gap in system design.",
    summary: "You handled the coding questions well but struggled to reason about scale.",
    assistance: {
      totalAnswers: 5,
      unaidedAnswers: 4,
      assistedAnswers: 1,
      headline: "You needed one nudge, on the sharding question.",
      narrative: "When asked to shard the wallet table, you needed a hint about hot keys.",
      breakdown: [{ label: "Clarifying hints", count: 1 }],
      moments: ["Hinted that a single counter would become a hot key."],
    },
    competencies: [
      {
        competency: "Coding",
        score: 4,
        maxScore: 5,
        rationale: "Clean iterative solution, reasoned about complexity unprompted.",
        evidenceQuote: "I'd use a hashmap here so the lookup is O(1) instead of scanning the list.",
        turnIndex: 0,
      },
      {
        competency: "System design",
        score: 2,
        maxScore: 5,
        rationale: "Reached a workable shape only after the interviewer narrowed the question.",
        evidenceQuote: "I'd shard by user id so one wallet lands on one node.",
        turnIndex: 2,
      },
    ],
    annotations: [
      {
        turnIndex: 0,
        question: "How would you find a duplicate in an array?",
        worked: "Landed on the O(n) hashmap approach.",
        vague: null,
        wouldProbe: "What if the array doesn't fit in memory?",
        strongerFraming: "Naming the space/time tradeoff up front would have shown more.",
      },
    ],
    communication: {
      structure: "Answers had a clear beginning, middle and end.",
      fillerDensity: "Low — under one filler word a minute.",
      pace: "A little fast under pressure, evened out by the third question.",
      rambling: "None observed.",
      handlingUncertainty: "Said 'I'm not sure, but here's my reasoning' rather than guessing silently.",
    },
    strengths: [
      {
        area: "Complexity reasoning",
        evidenceQuote: "That's O(n) since we only scan the array once.",
        turnIndex: 0,
        whyItMatters: "Interviewers weight this heavily for backend roles.",
        whatToDo: "Keep naming complexity even when not asked.",
      },
    ],
    developmentAreas: [
      {
        area: "Estimating scale",
        evidenceQuote: "I'm not sure how many requests that would be, maybe a lot?",
        turnIndex: 2,
        whyItMatters: "Sizing the problem is usually the first thing a system-design interviewer checks.",
        whatToDo: "Practise back-of-envelope math: users × actions/day × payload size.",
      },
    ],
    questionSources: {
      entries: [
        {
          turnIndex: 0,
          question: "How would you find a duplicate in an array?",
          phase: "main",
          probes: "Basic algorithmic reasoning.",
          askedBecause: "A standard opener for this archetype.",
          basis: "Common opener across product-company coding rounds.",
          tier: "model_knowledge",
          tierDisclosure: "This is a general pattern, not a specific report from this employer.",
          sources: [],
        },
      ],
      employerRecognised: false,
      archetypeLabel: "Product company",
      headline: "No employer-specific data was available for Flipkart, so questions follow the archetype.",
      disclosure: "Every question below is general knowledge, not a leaked report from this employer.",
    },
    practicePlan: [
      {
        focus: "Back-of-envelope estimation",
        why: "The one gap that cost the most in this round.",
        drill: "Practise sizing three systems a day for a week: users, QPS, storage.",
      },
    ],
    recommendedNextSession: "Another system design round with the same company.",
    outcomeSimulation: {
      label: "Likely to advance to the next round",
      likelihood: "Moderate confidence",
      reasoning: "Coding was strong; the system-design gap is common at this stage and coachable.",
    },
    ...overrides,
  };
}

describe("ReportDocument — the evidence quote", () => {
  it("shows the evidence quote directly, never behind the score-rationale disclosure", () => {
    render(<ReportDocument report={buildReport()} />);

    const quote = screen.getByText(/i'd shard by user id/i);
    expect(quote).toBeVisible();
    expect(quote.closest("details")).toBeNull();
  });

  it("keeps the rationale itself behind a disclosure, closed by default", () => {
    render(<ReportDocument report={buildReport()} />);

    expect(screen.getByText(/reached a workable shape only after/i)).not.toBeVisible();
  });
});

/**
 * Task 053 hard constraint: nothing on this page may describe how the candidate looked.
 * Nothing watches the candidate's camera (`RoundMediaProperties.presenceWasObserved`), so a
 * claim like "maintained good eye contact" would be fabricated evidence — the same failure
 * as an invented quote. This is a regression pin: none of these fixtures contain such a
 * claim today, and the assertion is that no future change introduces one as hardcoded copy.
 */
describe("ReportDocument never claims to have observed the candidate", () => {
  const bannedAppearanceClaims = [
    /eye contact/i,
    /body language/i,
    /facial expression/i,
    /\bsmiled\b/i,
    /\bposture\b/i,
    /looked (confident|nervous|engaged|relaxed)/i,
    /sat up straight/i,
    /leaned (in|forward|back)/i,
  ];

  it("renders no claim about the candidate's appearance or physical presence", () => {
    render(<ReportDocument report={buildReport()} />);

    const text = document.body.textContent ?? "";
    for (const claim of bannedAppearanceClaims) {
      expect(text).not.toMatch(claim);
    }
  });
});

describe("ReportDocument heading order", () => {
  it("has exactly one h1, followed by h2s and h3s that never skip a level", () => {
    render(<ReportDocument report={buildReport()} />);

    const levels = Array.from(document.querySelectorAll("h1, h2, h3, h4"), (node) =>
      Number(node.tagName.slice(1)),
    );

    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      const current = levels[i] ?? 0;
      const previous = levels[i - 1] ?? 0;
      expect(current - previous).toBeLessThanOrEqual(1);
    }
  });
});
