"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadVoices, pickVoice, speak, type SpokenHandle } from "@/lib/browser-speech";

/**
 * The interviewer's voice, when the browser can supply one worth using.
 *
 * Three things follow from speaking locally, and all three are the problems this room has
 * had since it was built. It starts in tens of milliseconds instead of six seconds. It
 * costs nothing, against a model quota of a hundred calls a day that has already turned a
 * real round into a silent one. And it reports where in the sentence it has got, so the
 * text can follow the voice exactly rather than being paced by a timer against a
 * recording's duration.
 *
 * Whether it is *used* is decided by what the browser actually has — see `pickVoice`.
 * A machine with only a decade-old formant voice is better served by the model, and one
 * with nothing at all falls back to the model as before.
 */
export interface BrowserVoice {
  /** Null until the voice list has loaded; then a voice, or null if none is usable. */
  voice: SpeechSynthesisVoice | null;
  /** False until we know. Nothing should branch on this before [settled]. */
  settled: boolean;
  available: boolean;
  /** Characters of the current utterance spoken so far. */
  spokenChars: number;
  speaking: boolean;
  /**
   * The text being spoken right now, and the last text spoken to the end.
   *
   * Both are state rather than refs on purpose: the room decides how much of a question to
   * show from them, so they are read during render, and "have we started this one yet" is
   * exactly the question a ref cannot answer there.
   */
  saying: string | null;
  said: string | null;
  /** Speak [text]. Resolves through `onDone` rather than a promise so it can be cancelled. */
  say: (text: string, onDone?: () => void) => void;
  cancel: () => void;
}

export function useBrowserVoice({ language }: { language: string }): BrowserVoice {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [settled, setSettled] = useState(false);
  const [spokenChars, setSpokenChars] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [saying, setSaying] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const handle = useRef<SpokenHandle | null>(null);

  useEffect(() => {
    let active = true;
    void loadVoices().then((voices) => {
      if (!active) return;
      setVoice(pickVoice(voices, language));
      setSettled(true);
    });
    return () => {
      active = false;
    };
  }, [language]);

  const cancel = useCallback(() => {
    handle.current?.cancel();
    handle.current = null;
    setSpeaking(false);
    setSaying(null);
  }, []);

  const say = useCallback(
    (text: string, onDone?: () => void) => {
      handle.current?.cancel();
      setSpokenChars(0);
      setSpeaking(true);
      setSaying(text);
      setSaid(null);
      handle.current = speak({
        text,
        voice,
        onProgress: setSpokenChars,
        onEnd: () => {
          setSpeaking(false);
          setSaying(null);
          // Marked said even when the utterance failed: the question still has to appear,
          // and an unspoken question on screen beats a blank room.
          setSaid(text);
          handle.current = null;
          onDone?.();
        },
      });
    },
    [voice],
  );

  // Leaving mid-question must not leave a voice talking to an empty page.
  useEffect(() => () => handle.current?.cancel(), []);

  return { voice, settled, available: voice !== null, spokenChars, speaking, saying, said, say, cancel };
}
