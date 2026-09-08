import { describe, expect, it } from "vitest";

import { pickVoice, rank } from "./browser-speech";

/**
 * Choosing the voice is the whole decision here: a modern neural voice is worth using
 * instead of paying a model for one, and a decade-old formant voice is worth using only
 * when the alternative is silence. Everything else in this module needs a browser; this
 * does not, so this is what gets tested.
 */
const voice = (name: string, lang: string, localService = true) =>
  ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe("rank", () => {
  it("recognises the neural voices by the names the platforms give them", () => {
    expect(rank(voice("Microsoft Aria Online (Natural) - English (United States)", "en-US"))).toBe("natural");
    expect(rank(voice("Google UK English Female", "en-GB"))).toBe("basic");
    expect(rank(voice("Microsoft Neural Ravi", "en-IN"))).toBe("natural");
  });

  it("treats an ordinary system voice as usable but not preferred", () => {
    expect(rank(voice("Microsoft David Desktop", "en-US"))).toBe("basic");
  });

  /** An interviewer must not be conducted in a novelty voice, however amusing. */
  it("refuses novelty voices", () => {
    expect(rank(voice("Zarvox", "en-US"))).toBe("unusable");
    expect(rank(voice("Bad News", "en-US"))).toBe("unusable");
  });

  it("refuses a language the round is not conducted in", () => {
    expect(rank(voice("Microsoft Natural Ana", "fr-FR"))).toBe("unusable");
    expect(rank(voice("Google Deutsch", "de-DE"))).toBe("unusable");
  });
});

describe("pickVoice", () => {
  /**
   * Quality wins over accent. A natural British voice is a better interviewer than a
   * robotic Indian one, even though the accent is the closer match.
   */
  it("prefers a natural voice over a closer accent that is basic", () => {
    const chosen = pickVoice(
      [voice("Microsoft Ravi Desktop", "en-IN"), voice("Microsoft Sonia Online (Natural)", "en-GB")],
      "english",
    );

    expect(chosen?.name).toBe("Microsoft Sonia Online (Natural)");
  });

  /** Between two of the same quality, an interview for a role in India sounds Indian. */
  it("prefers Indian English when quality is equal", () => {
    const chosen = pickVoice(
      [voice("Microsoft Aria Natural", "en-US"), voice("Microsoft Neerja Natural", "en-IN")],
      "english",
    );

    expect(chosen?.name).toBe("Microsoft Neerja Natural");
  });

  it("reaches for Hindi only when the round is code-switched", () => {
    const options = [voice("Microsoft Swara Natural", "hi-IN"), voice("Microsoft Neerja Natural", "en-IN")];

    expect(pickVoice(options, "hindi_english")?.lang).toBe("hi-IN");
    expect(pickVoice(options, "english")?.lang).toBe("en-IN");
  });

  it("will still use a basic voice rather than nothing", () => {
    expect(pickVoice([voice("Microsoft David Desktop", "en-US")], "english")?.name).toBe(
      "Microsoft David Desktop",
    );
  });

  /**
   * Null is a real answer and the caller depends on it: it means fall back to the model's
   * recording rather than speak in French or not at all.
   */
  it("returns nothing when the browser has nothing usable", () => {
    expect(pickVoice([], "english")).toBeNull();
    expect(pickVoice([voice("Google Deutsch", "de-DE"), voice("Zarvox", "en-US")], "english")).toBeNull();
  });
});
