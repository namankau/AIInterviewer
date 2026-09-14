import type { EmployerArchetype, RoundType } from "./domain.js";

/**
 * The company-tagged question bank (PRD 04, 08). Signed-in candidates only.
 *
 * Every question here was read out of a document we fetched, and every company tag on it
 * is backed by at least one such document that says so. Nothing in the bank was written
 * by a model.
 */

/** How we may use a source, shown beside every citation. */
export type SourceOrigin = "employer" | "open_licence" | "author";

export interface BankRoundTypeCount {
  /** Null when the source did not say which round the question came from. */
  roundType: RoundType | null;
  count: number;
}

/** `GET /api/v1/question-bank/companies` — one entry per company with a sourced question. */
export interface BankCompany {
  slug: string;
  name: string;
  /** The archetype a round for this company runs on — the same one the room uses. */
  archetype: EmployerArchetype;
  archetypeLabel: string;
  /** The archetype mid-sentence, article included: "a global product company loop". */
  archetypeInProse: string;
  questionCount: number;
  /** In catalogue order, with the unstated round last. */
  roundTypes: BankRoundTypeCount[];
}

/** Question Q is reported at this company by `corroboration` sources. */
export interface BankCompanyTag {
  slug: string;
  name: string;
  corroboration: number;
  /** ISO date: the latest a source says it was asked, else the latest publication date. */
  lastReported: string | null;
}

export interface BankCitation {
  title: string;
  publisher: string | null;
  url: string | null;
  year: number | null;
  /** Null for sources added before origins were recorded. */
  origin: SourceOrigin | null;
}

export interface BankQuestion {
  id: string;
  text: string;
  roundType: RoundType | null;
  /** Always `published_source`: only fetched documents put a question in the bank. */
  tier: "published_source";
  /** Distinct sources reporting it, at any company. */
  corroboration: number;
  lastReported: string | null;
  /** Every company it carries — not only the one being browsed. */
  companies: BankCompanyTag[];
  citations: BankCitation[];
}

/** `GET /api/v1/question-bank?company=<slug>&roundType=&limit=&offset=` */
export interface BankQuestionPage {
  company: BankCompany;
  roundType: RoundType | null;
  questions: BankQuestion[];
  total: number;
  limit: number;
  offset: number;
}
