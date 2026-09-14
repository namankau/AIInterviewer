import type { EmployerArchetype, RoundType } from "./domain.js";
import type { BankCitation, BankRoundTypeCount } from "./question-bank.js";

/**
 * Before the round: how a company interviews for a role, laid out (PRD 04, 08, 09, 10).
 *
 * The rule that shapes this contract: `sourcedStages` come only from documents we have
 * actually read, each carrying its own citations. `generalPattern` is the model's
 * archetype-level contribution, composed without ever being told the company's name —
 * it can describe how loops at this kind of employer usually run, and nothing else.
 */

export interface LoopBriefCompany {
  /** Null when this is not a company we hold — the brief still runs on the archetype alone. */
  slug: string | null;
  name: string;
  archetype: EmployerArchetype;
  archetypeLabel: string;
  archetypeInProse: string;
  /** `recognised` (in the routing table) or `inferred` (guessed from the name). */
  archetypeConfidence: "recognised" | "inferred";
}

export interface LoopBriefStage {
  stageName: string;
  roleFamily: string | null;
  order: number | null;
  format: string | null;
  durationMinutes: number | null;
  assesses: string | null;
  /** Null when this stage is not one this product simulates as a round. */
  roundType: RoundType | null;
  citations: BankCitation[];
}

export interface GeneralLoopStage {
  order: number;
  stageName: string;
  format: string | null;
  assesses: string | null;
  roundType: RoundType | null;
}

export interface LoopBriefCoverage {
  questionCount: number;
  roundTypes: BankRoundTypeCount[];
  /** Link to `/questions/<slug>`, null when we hold no company. */
  bankUrl: string | null;
}

/** `GET /api/v1/loop-brief?company=&role=&level=` */
export interface LoopBrief {
  company: LoopBriefCompany;
  /** False when we hold no source at all for this company — show the honest empty state. */
  hasSources: boolean;
  sourcedStages: LoopBriefStage[];
  generalPattern: GeneralLoopStage[];
  bankCoverage: LoopBriefCoverage;
}

export interface PrepPlanItem {
  roundType: RoundType;
  roundLabel: string;
  stageName: string;
  why: string;
  focusAreas: string[];
  suggestedMinutes: number;
  /** Empty unless this round is tied to a stage a fetched source actually reports. */
  citations: BankCitation[];
}

export interface PrepPlanUnsimulatedStage {
  stageName: string;
  note: string;
}

/** `GET /api/v1/prep-plan?company=&role=&level=` — never persisted, computed per request. */
export interface PrepPlan {
  items: PrepPlanItem[];
  unsimulatedStages: PrepPlanUnsimulatedStage[];
}
