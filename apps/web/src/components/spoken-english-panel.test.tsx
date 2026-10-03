import type { ReportSpokenEnglish } from "@acemyinterview/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpokenEnglishPanel } from "./spoken-english-panel";

function measured(overrides: Partial<ReportSpokenEnglish> = {}): ReportSpokenEnglish {
  return {
    languageAssessed: true,
    scope: "How you spoke: pace and pauses measured from your microphone level. Accent and pronunciation are not assessed.",
    answersTotal: 2,
    answersTimed: 2,
    timingNote: null,
    wordCount: 257,
    wordsPerMinute: 172,
    paceBand: "above",
    paceNote: "Roughly 120–160 words per minute is a range commonly cited for comfortable conversational English.",
    pauseCount: 3,
    longestPauseSeconds: 2.5,
    pauseSharePercent: 5,
    medianFirstWordSeconds: 1.6,
    hesitationCount: 4,
    hesitationsPer100Words: 1.6,
    answers: [
      { turnIndex: 0, words: 152, wordsPerMinute: 152, pauseCount: 2, longestPauseSeconds: 2.5, firstWordSeconds: 1.2 },
      { turnIndex: 1, words: 6, wordsPerMinute: null, pauseCount: 0, longestPauseSeconds: 0, firstWordSeconds: 2 },
    ],
    observations: [
      {
        aspect: "filler_words",
        aspectLabel: "Filler words",
        finding: "\"Basically\" twice in one sentence adds nothing.",
        evidenceQuote: "So basically we, like, basically moved the queue",
        turnIndex: 1,
        suggestion: "Open with the verb: \"We moved the queue to Kafka.\"",
      },
    ],
    ...overrides,
  };
}

describe("SpokenEnglishPanel", () => {
  it("shows the measured figures under a labelled section", () => {
    render(<SpokenEnglishPanel spoken={measured()} />);

    const section = screen.getByRole("region", { name: "Spoken English" });
    expect(within(section).getByText("172 words per minute")).toBeInTheDocument();
    expect(within(section).getByText("Above the conversational range")).toBeInTheDocument();
    expect(within(section).getByText(/120–160 words per minute/)).toBeInTheDocument();
    expect(within(section).getByText("longest 2.5 seconds · 5% of your speaking time")).toBeInTheDocument();
    expect(within(section).getByText("1.6 seconds")).toBeInTheDocument();
    expect(within(section).getByText("1.6 per 100 words, across 257 words")).toBeInTheDocument();
    expect(within(section).getByText(/Accent and pronunciation are not assessed/)).toBeInTheDocument();
  });

  it("ties every observation to the candidate's own words", () => {
    render(<SpokenEnglishPanel spoken={measured()} />);

    const observations = screen.getByRole("region", { name: "How you used English" });
    expect(within(observations).getByText("Filler words")).toBeInTheDocument();
    expect(within(observations).getByText(/So basically we, like, basically moved the queue/)).toBeInTheDocument();
    expect(within(observations).getByText("question 2")).toBeInTheDocument();
    expect(within(observations).getByText(/Open with the verb/)).toBeInTheDocument();
  });

  it("lists each answer's timing, with a dash where an answer could not be measured", () => {
    render(<SpokenEnglishPanel spoken={measured()} />);

    const table = screen.getByRole("table", { name: "Measured timing for each answer" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    const tooShort = rows[2] as HTMLElement;
    expect(within(tooShort).getAllByLabelText("not measured").length).toBeGreaterThan(0);
  });

  it("says a figure was not measured, and why, rather than showing a number", () => {
    render(
      <SpokenEnglishPanel
        spoken={measured({
          answersTimed: 0,
          timingNote: "No timing was recorded for these answers, so pace and pauses are not shown.",
          wordsPerMinute: null,
          paceBand: null,
          paceNote: "Pace was not measured for this round.",
          pauseCount: null,
          longestPauseSeconds: null,
          pauseSharePercent: null,
          medianFirstWordSeconds: null,
          answers: [],
        })}
      />,
    );

    expect(screen.getByText(/No timing was recorded for these answers/)).toBeInTheDocument();
    expect(screen.getAllByText("Not measured")).toHaveLength(3);
    expect(screen.queryByText(/words per minute$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/conversational range/)).not.toBeInTheDocument();
  });

  it("leaves English unassessed in a Hindi-English round", () => {
    render(
      <SpokenEnglishPanel
        spoken={measured({
          languageAssessed: false,
          scope: "You chose a Hindi-English round, so your English is not assessed here and switching between the two languages is not counted against you.",
          paceBand: null,
          hesitationCount: null,
          hesitationsPer100Words: null,
          observations: [],
        })}
      />,
    );

    expect(screen.getByText(/switching between the two languages is not counted against you/)).toBeInTheDocument();
    expect(screen.queryByText("Hesitation sounds")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "How you used English" })).not.toBeInTheDocument();
    expect(screen.queryByText(/No observation about your English/)).not.toBeInTheDocument();
  });

  it("says plainly when no observation could be tied to a quote", () => {
    render(<SpokenEnglishPanel spoken={measured({ observations: [] })} />);

    expect(screen.getByText(/No observation about your English could be tied to a quote/)).toBeInTheDocument();
  });

  it("explains an older report that predates the section instead of showing nothing", () => {
    render(<SpokenEnglishPanel spoken={undefined} />);

    expect(screen.getByRole("heading", { name: "Spoken English" })).toBeInTheDocument();
    expect(screen.getByText(/written before spoken-English feedback existed/)).toBeInTheDocument();
  });
});
