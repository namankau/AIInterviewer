import type { BankCitation, RoundType } from "@acemyinterview/shared";

import { ROUND_CATALOGUE } from "@/lib/rounds";

/**
 * How a citation's origin reads to a candidate.
 *
 * The distinction is the point. An employer describing its own process and one engineer
 * recounting their loop are different kinds of evidence, and a list that rendered them
 * identically would be hiding that from the person who most needs to weigh it.
 */
export function describeOrigin(citation: BankCitation): string {
  const publisher = citation.publisher?.trim() || null;
  switch (citation.origin) {
    case "employer":
      return publisher ? `${publisher}’s own site` : "The employer’s own site";
    case "author":
      return publisher ? `A published account by ${publisher}` : "A published account by its author";
    case "open_licence":
      return publisher ? `An openly licensed document from ${publisher}` : "An openly licensed document";
    default:
      return publisher ?? "A source in our library";
  }
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "January 2025" from an ISO date, or null. Month and year: a day would claim precision nobody has. */
export function monthYear(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : MONTH_YEAR.format(date);
}

/** The candidate-facing name of a round type, from the same catalogue the rest of the app uses. */
export function roundLabel(roundType: RoundType | null): string {
  if (!roundType) return "Round not stated";
  return ROUND_CATALOGUE.find((round) => round.value === roundType)?.label ?? roundType;
}

/** "1 source" / "3 sources". */
export function sources(count: number): string {
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

/** "1 question" / "12 questions". */
export function questions(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}
