/**
 * The facts the legal pages state, in one place, so the privacy policy, the terms and the
 * contact page cannot disagree with each other or with the product.
 *
 * Anything only the owner can supply comes from the environment and renders a visible
 * "to be confirmed" marker when unset, rather than a plausible-looking invented value: a
 * made-up grievance officer or address in a privacy policy is worse than an obvious gap.
 */
const UNCONFIRMED = "[to be confirmed before launch]";

export const LEGAL = {
  productName: "AceMyInterview",
  /** The person or company responsible for the data (the "Data Fiduciary"). */
  operatorName: process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME || UNCONFIRMED,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  /** Required by the DPDP Act: who handles privacy complaints. */
  grievanceOfficer: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME || UNCONFIRMED,
  /** Where the database and stored files live (the linked Supabase project's region). */
  dataRegion: "India (Mumbai, ap-south-1)",
  /** Kept in step with `interviewos.retention.reports-kept-for` on the API. */
  reportRetentionDays: 28,
  dailyRounds: 2,
  dailyMinutes: 60,
  lastUpdated: "8 October 2026",
} as const;

export const CONTACT_EMAIL_DISPLAY = LEGAL.contactEmail || UNCONFIRMED;
