import type { RoundType } from "@acemyinterview/shared";

/**
 * The rounds, described the way someone who has sat on both sides of the table would
 * describe them.
 *
 * One list, used by both the catalogue and the setup form, so a round cannot be
 * described one way on the page that sells it and another way on the page that starts
 * it. The rubric behind each one lives on the server (`RoundType` in the API) — this is
 * the candidate-facing wording only.
 *
 * Every entry names real employers. That is the whole argument: the tools that already
 * exist cover the last two rows and nothing else.
 */
export interface CatalogueRound {
  value: RoundType;
  /** The archetype this round belongs to, set small above the title. */
  eyebrow: string;
  label: string;
  /** The short form, used where space is tight. */
  blurb: string;
  /** What an interviewer is actually assessing, as opposed to what is being asked. */
  listeningFor: string;
  whoRunsIt: string;
}

export const ROUND_CATALOGUE: CatalogueRound[] = [
  {
    value: "aptitude",
    eyebrow: "Campus placement",
    label: "Aptitude and reasoning, spoken",
    blurb:
      "Quantitative, logical reasoning, data interpretation and verbal ability — worked out " +
      "loud, with nothing to write on. No options to pick from, because the method is the answer.",
    listeningFor:
      "how you set a problem up before you start computing, and what you do when you notice " +
      "halfway through that you have gone wrong.",
    // Deliberately no employer names and no test structure. Which companies run a
    // reasoning gate, how long it lasts and how many sections it has are claims we cannot
    // source — the employers do not publish them, and the figures in circulation come from
    // prep aggregators. What is true at archetype level is that high-volume graduate
    // hiring usually screens on reasoning before anything technical, so that is what this
    // says. (CLAUDE.md: never fabricate employer-specific detail; task 048.)
    whoRunsIt:
      "service-based IT, consulting and other high-volume graduate hiring, where a reasoning " +
      "gate usually comes before any technical round",
  },
  {
    value: "project_deep_dive",
    eyebrow: "Your own work",
    label: "Project deep-dive",
    blurb:
      "The project on your CV, interrogated line by line. What you personally decided, what " +
      "you traded away to get it, and what you would do differently now.",
    listeningFor:
      "whether the work was yours. Vague ownership — “we decided”, “it was handled” — is the " +
      "thing this round is built to surface.",
    whoRunsIt: "Infosys · TCS · Cognizant · Accenture · almost every loop, somewhere",
  },
  {
    value: "techno_managerial",
    eyebrow: "Service-based IT",
    label: "Techno-managerial",
    blurb:
      "The MR round. Delivery, estimation, escalation, and what you did the week the plan " +
      "slipped and the client noticed before you did.",
    listeningFor:
      "judgement under a deadline, and whether you escalate early or go quiet and hope.",
    whoRunsIt: "TCS · Infosys · Wipro · LTIMindtree · HCLTech · Capgemini",
  },
  {
    value: "case_client_scenario",
    eyebrow: "Consulting and Big Four",
    label: "Case and client scenario",
    blurb:
      "A client situation to structure out loud, getting harder as you get comfortable. " +
      "Sizing, assumptions, and what you would tell the client on Monday.",
    listeningFor:
      "a structure you actually use rather than a framework you recite, and assumptions you " +
      "state instead of smuggle.",
    whoRunsIt: "Deloitte · EY · PwC · KPMG · Accenture Strategy",
  },
  {
    value: "system_design",
    eyebrow: "Global product",
    label: "System or solution design",
    blurb:
      "Requirements you have to pull out of the interviewer, then components, data flow, " +
      "what breaks at scale, and the trade-off you can defend when it is pushed on.",
    listeningFor:
      "whether you design for the requirement or for the diagram, and whether you name the " +
      "cost of your own choices before you are asked.",
    whoRunsIt: "Google · Amazon · Microsoft · Atlassian · Uber · Adobe",
  },
  {
    value: "coding_practical",
    eyebrow: "Global and Indian product",
    label: "Coding, spoken aloud",
    blurb:
      "A practical problem reasoned through in speech rather than typed. Approach, edge " +
      "cases, complexity — the parts an interviewer is actually grading.",
    listeningFor:
      "whether you can be followed. A correct solution nobody could follow does not pass a " +
      "real round either.",
    whoRunsIt: "Zoho · Flipkart · Razorpay · Swiggy · Google · Amazon",
  },
  {
    value: "behavioural_competency",
    eyebrow: "European employers and global product",
    label: "Behavioural and competency",
    blurb:
      "Structured competency questions that want one specific situation, with what you did " +
      "in it — not your general policy on the subject.",
    listeningFor:
      "a real week in your life. Answers in the present tense about what you “always” do are " +
      "the tell, and they get pushed on.",
    whoRunsIt: "Booking.com · Adyen · SAP · Zalando · Amazon · Microsoft",
  },
  {
    value: "technical_fundamentals",
    eyebrow: "Campus and early career",
    label: "Technical fundamentals",
    blurb:
      "Concept depth at your level — the DBMS, OS and core-language questions that open most " +
      "service-company loops and every fresher panel.",
    listeningFor:
      "precision over vocabulary. Knowing the word for a thing and knowing the thing sound " +
      "different under one follow-up.",
    whoRunsIt: "TCS NQT · Infosys · Wipro · Cognizant · GCC graduate programmes",
  },
  {
    value: "hr_fit_closing",
    eyebrow: "Every loop, and the one nobody rehearses",
    label: "HR, fit and closing",
    blurb:
      "Notice period, compensation expectations, relocation, work authorisation, and why you " +
      "are leaving. Direct, because the real one is.",
    listeningFor:
      "whether you have a number and can say it without apologising for it, and whether your " +
      "reason for leaving survives a second question.",
    whoRunsIt: "everyone — and it is the round most candidates walk into cold",
  },
];
