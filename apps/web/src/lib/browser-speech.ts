"use client";

/**
 * The interviewer's voice, spoken by the browser instead of bought from a model.
 *
 * Every question currently costs one call against a speech quota of a hundred a day and
 * about six seconds of the candidate sitting in silence. The browser has had a speech
 * synthesiser built into it for a decade: it is free, it has no quota, it starts speaking
 * in tens of milliseconds rather than seconds, and it reports a `boundary` event as it
 * reaches each word — which is the text-and-voice synchronisation we have been
 * approximating with a timer since the beginning.
 *
 * **It is not automatically better, which is why this ranks rather than just grabs.** A
 * decade-old bundled voice sounds like a decade-old bundled voice, and this product is
 * selling realism. The modern neural voices — "Microsoft Aria Online (Natural)", Google's
 * network voices — are a different thing entirely and are worth preferring over a paid
 * call. The old formant ones are worth using only when the alternative is silence.
 *
 * So the order is: a good local voice, then the model, then any local voice, then text.
 * [rank] is what decides which bucket a voice falls into, and it is the only part of this
 * file that can be tested without a browser, so it is the part that is.
 */

/** How good a voice is, and therefore whether it beats paying for one. */
export type VoiceQuality =
  /** A modern neural voice. Comparable to the model, instant, and free. */
  | "natural"
  /** An ordinary system voice. Intelligible, obviously synthetic. Better than silence. */
  | "basic"
  /** Not usable for this — wrong language, or a novelty voice. */
  | "unusable";

/**
 * Names the platforms give their neural voices. Matching on the name is unpleasant and it
 * is also the only signal available: `SpeechSynthesisVoice` exposes no quality field at
 * all, and `localService` marks *where* a voice runs rather than how good it is.
 */
const NATURAL_MARKERS = ["natural", "neural", "online", "premium", "enhanced", "eloquence", "siri"];

/** Voices that exist for accessibility or novelty and would be absurd in an interview. */
const EXCLUDED = ["novelty", "eloquence rocko", "bad news", "bells", "bubbles", "jester", "organ", "zarvox", "whisper"];

export function rank(voice: Pick<SpeechSynthesisVoice, "name" | "lang">): VoiceQuality {
  const name = voice.name.toLowerCase();
  if (EXCLUDED.some((bad) => name.includes(bad))) return "unusable";
  if (!voice.lang.toLowerCase().startsWith("en") && !voice.lang.toLowerCase().startsWith("hi")) return "unusable";
  return NATURAL_MARKERS.some((good) => name.includes(good)) ? "natural" : "basic";
}

/**
 * The best voice for [language], or null if the browser has nothing worth using.
 *
 * Indian English is preferred and then Hindi for a code-switched round, because an
 * interviewer for a role in India who speaks in a Californian accent is a small break in
 * the illusion that the candidate will notice immediately. Beyond that it is quality
 * first: a natural en-GB voice beats a basic en-IN one.
 */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  language: string,
): SpeechSynthesisVoice | null {
  const wantsHindi = language === "hindi_english";
  const scored = voices
    .map((voice) => ({ voice, quality: rank(voice) }))
    .filter((it) => it.quality !== "unusable");
  if (scored.length === 0) return null;

  const score = ({ voice, quality }: { voice: SpeechSynthesisVoice; quality: VoiceQuality }) => {
    const lang = voice.lang.toLowerCase().replace("_", "-");
    let points = quality === "natural" ? 100 : 0;
    if (wantsHindi && lang.startsWith("hi")) points += 40;
    if (lang.startsWith("en-in")) points += 30;
    else if (lang.startsWith("en-gb")) points += 10;
    else if (lang.startsWith("en")) points += 5;
    return points;
  };

  return scored.reduce((best, it) => (score(it) > score(best) ? it : best)).voice;
}

/**
 * The browser's voices, once it has them.
 *
 * `getVoices()` is empty on first call in most browsers and fills in asynchronously, which
 * is a long-standing quirk rather than a bug to route around. The timeout is the answer to
 * the browsers where `voiceschanged` never fires at all: an empty list is a real answer
 * here — it means fall back to the model — so waiting forever for a better one is worse
 * than accepting it.
 */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);
  const synthesis = window.speechSynthesis;

  const now = synthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synthesis.removeEventListener("voiceschanged", finish);
      resolve(synthesis.getVoices());
    };
    synthesis.addEventListener("voiceschanged", finish);
    window.setTimeout(finish, timeoutMs);
  });
}

export interface SpokenHandle {
  /** Stop immediately. Safe to call after it has already finished. */
  cancel: () => void;
}

/**
 * How long to wait for the voice to actually begin before giving up on it.
 *
 * Generous, because starting is not instant on every machine and cutting off a voice that
 * was about to speak is worse than a short wait. Short enough that a candidate does not
 * sit in front of a blank question wondering whether the round has begun — which is
 * exactly what happened, for three minutes, with no timeout here at all.
 */
const START_TIMEOUT_MS = 3_000;

/** How long a started voice may go without a `boundary` before the text is shown whole. */
const BOUNDARY_GRACE_MS = 1_200;

/**
 * Speaks [text], reporting how far through it the voice has actually got.
 *
 * `onProgress` is given the number of characters spoken so far, straight from the
 * synthesiser's own `boundary` events. That is the real thing the reveal has been
 * imitating: the text can now be shown exactly as far as the voice has reached, because
 * the voice is the one saying where that is.
 */
export function speak({
  text,
  voice,
  rate = 1,
  onProgress,
  onEnd,
}: {
  text: string;
  voice: SpeechSynthesisVoice | null;
  rate?: number;
  onProgress?: (charactersSpoken: number) => void;
  onEnd?: (reason: "finished" | "failed") => void;
}): SpokenHandle {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.("failed");
    return { cancel: () => undefined };
  }
  const synthesis = window.speechSynthesis;
  // Anything still queued belongs to a question that has been answered already.
  synthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = rate;

  let started = false;
  let sawBoundary = false;
  let done = false;
  const timers: number[] = [];
  const clearTimers = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers.length = 0;
  };

  /** Exactly one end, whoever gets there first. */
  const finish = (reason: "finished" | "failed") => {
    if (done) return;
    done = true;
    clearTimers();
    onEnd?.(reason);
  };

  utterance.onstart = () => {
    started = true;
    // Some voices — Chrome's network ones especially — speak the whole utterance without
    // ever firing `boundary`. The reveal is driven by those events, so the question would
    // stay invisible for as long as it is being read aloud. Show it whole instead: an
    // unsynchronised question beats a blank room with a voice talking over it.
    timers.push(
      window.setTimeout(() => {
        if (!sawBoundary) onProgress?.(text.length);
      }, BOUNDARY_GRACE_MS),
    );
  };
  utterance.onboundary = (event) => {
    sawBoundary = true;
    onProgress?.(event.charIndex);
  };
  utterance.onend = () => {
    onProgress?.(text.length);
    finish("finished");
  };
  // A refusal is not worth surfacing to the candidate; it means fall back to the model's
  // recording, and the caller decides that.
  utterance.onerror = () => finish("failed");

  synthesis.speak(utterance);

  // An utterance can be dropped without ever reporting start, end or error — a tab that
  // was in the background, the autoplay policy, or Chrome's own queue losing it. Nothing
  // above fires in that case, and the room hands the floor over on `onEnd`, so without
  // this the candidate waits for a question that is never spoken and never appears, in
  // front of a microphone that never opens. Treating silence as failure costs a question
  // read on screen instead of aloud; not treating it as failure costs the round.
  timers.push(
    window.setTimeout(() => {
      if (!started) finish("failed");
    }, START_TIMEOUT_MS),
  );

  return {
    cancel: () => {
      done = true;
      clearTimers();
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      utterance.onboundary = null;
      synthesis.cancel();
    },
  };
}
