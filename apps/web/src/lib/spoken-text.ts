/**
 * Matching a question's text to the voice reading it.
 *
 * The room used to put the whole question on screen the moment it arrived, then start
 * speaking it five to fifteen seconds later. Reading something, waiting, and then being
 * read it back is worse than either on its own — it breaks the illusion that anyone is
 * talking to you, and it invites the candidate to answer a question the interviewer has
 * not finished asking.
 *
 * Gemini's speech carries no word timings, so this paces the reveal by position in the
 * audio. That is an approximation, but the ear is forgiving about a word arriving a
 * beat early and completely unforgiving about text and voice being ten seconds apart.
 *
 * Kept pure and separate from the hook so the pacing can be tested without an
 * `<audio>` element.
 */

/**
 * How much of the text to have revealed at a given point in the audio.
 *
 * Runs slightly ahead of the voice — a reader who is fractionally in front of the
 * speaker feels natural, and one who lags feels broken. The lead is a fraction of the
 * whole rather than a fixed number of words, so it scales with the question.
 */
const LEAD = 0.04;

/** Split on whitespace, keeping the separators so the reveal does not reflow the text. */
export function wordsOf(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

/**
 * The portion of [text] that should be visible at [currentTime] of [duration].
 *
 * A duration that is zero, negative or not yet known means the audio element cannot tell
 * us where it is, so the whole question is returned rather than withholding it. Being
 * unable to sync is not a reason to leave the candidate with nothing to read.
 */
export function revealedText(text: string, currentTime: number, duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) return text;

  const progress = currentTime / duration + LEAD;
  if (progress >= 1) return text;
  if (progress <= 0) return "";

  const parts = wordsOf(text);
  // Count only the words, so a run of whitespace does not consume the budget.
  const wordCount = parts.filter((part) => part.trim().length > 0).length;
  const target = Math.ceil(wordCount * progress);

  let seen = 0;
  let out = "";
  for (const part of parts) {
    if (part.trim().length > 0) {
      if (seen >= target) break;
      seen += 1;
    }
    out += part;
  }
  return out;
}
