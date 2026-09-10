import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pickVoice, rank, speak } from "./browser-speech";

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

/**
 * What happens when the synthesiser does not behave.
 *
 * These exist because of a real round. The room reveals the question from `boundary`
 * events and hands the candidate the microphone from `onEnd`, so an utterance that
 * reports nothing leaves a blank question on screen and a microphone that never opens.
 * That is not a degraded round, it is a round that cannot start, and it ran for three
 * minutes before the candidate gave up on it.
 */
class FakeUtterance {
  voice: SpeechSynthesisVoice | null = null;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: ((event: { charIndex: number }) => void) | null = null;
  constructor(public text: string) {}
}

describe("speak", () => {
  const QUESTION = "Tell me about a system you designed.";
  let uttered: FakeUtterance[];

  /** The utterance handed to the synthesiser, or a failure that says so plainly. */
  const spoken = (): FakeUtterance => {
    const utterance = uttered[0];
    if (!utterance) throw new Error("speak() never reached the synthesiser");
    return utterance;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    uttered = [];
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      speak: (utterance: FakeUtterance) => uttered.push(utterance),
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.speechSynthesis = globalThis.speechSynthesis;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** The bug: no start, no end, no error. Nothing above ever fires. */
  it("gives up on an utterance the browser silently drops", () => {
    const onEnd = vi.fn();
    speak({ text: QUESTION, voice: null, onEnd });

    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3_000);

    expect(onEnd).toHaveBeenCalledExactlyOnceWith("failed");
  });

  /**
   * Chrome's network voices speak without ever firing `boundary`. The question must not
   * stay invisible for as long as it is being read aloud.
   */
  it("shows the question whole when a voice speaks without reporting words", () => {
    const onProgress = vi.fn();
    const handle = speak({ text: QUESTION, voice: null, onProgress });
    spoken().onstart?.();

    vi.advanceTimersByTime(1_200);

    expect(onProgress).toHaveBeenCalledWith(QUESTION.length);
    handle.cancel();
  });

  it("leaves a voice that does report words to drive the reveal itself", () => {
    const onProgress = vi.fn();
    speak({ text: QUESTION, voice: null, onProgress });
    spoken().onstart?.();
    spoken().onboundary?.({ charIndex: 8 });

    vi.advanceTimersByTime(1_200);

    expect(onProgress).toHaveBeenCalledWith(8);
    expect(onProgress).not.toHaveBeenCalledWith(QUESTION.length);
  });

  /** A voice that started must never then be declared failed by the start watchdog. */
  it("does not end a second time once the voice has finished", () => {
    const onEnd = vi.fn();
    speak({ text: QUESTION, voice: null, onEnd });
    spoken().onstart?.();
    spoken().onend?.();

    vi.advanceTimersByTime(10_000);

    expect(onEnd).toHaveBeenCalledExactlyOnceWith("finished");
  });

  /** Leaving the room mid-question must not fire a watchdog at the next screen. */
  it("stops watching once cancelled", () => {
    const onEnd = vi.fn();
    speak({ text: QUESTION, voice: null, onEnd }).cancel();

    vi.advanceTimersByTime(10_000);

    expect(onEnd).not.toHaveBeenCalled();
  });
});
