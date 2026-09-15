/**
 * Whether candidates can browse the sourced question bank at `/questions` (task 042).
 *
 * Off unless `NEXT_PUBLIC_QUESTION_BANK_BROWSABLE` is exactly `true`. The API reads the same
 * variable for `interviewos.question-bank.browsable`, so the pages, the nav entry and the API's
 * list endpoints move together. Hiding the bank hides the browsing only: rounds keep asking
 * from it, server-side.
 *
 * A function rather than a constant so a test can flip it; Next still inlines the literal
 * `process.env.NEXT_PUBLIC_…` reference at build time.
 */
export function questionBankBrowsable(): boolean {
  return process.env.NEXT_PUBLIC_QUESTION_BANK_BROWSABLE === "true";
}
