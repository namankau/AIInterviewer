"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What the candidate is saying, on screen, as they say it.
 *
 * Speaking into a machine with no visible response is the part of this that feels least
 * like an interview: you cannot tell whether you are being heard, whether the microphone
 * is working, or whether the thing on the other side is getting your words right. A real
 * interviewer's face answers all three continuously. This is the closest substitute.
 *
 * **It is a mirror, not a record.** The report is still built from the model's own
 * transcription of the recording — this never reaches the server and never touches an
 * assessment. That separation matters: the browser's recogniser is fast and free and
 * wrong often enough that scoring somebody against it would be unfair, and the two
 * disagreeing is not a bug in either.
 *
 * `SpeechRecognition` is Chrome and Edge only, and on those it sends audio to Google's
 * speech service to do the work. Absent elsewhere, in which case [supported] is false and
 * the room simply does not show a transcript — nothing else changes.
 */

type Recogniser = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

function recogniserClass(): (new () => Recogniser) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recogniser;
    webkitSpeechRecognition?: new () => Recogniser;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether this browser can do it at all. Safe to call during render. */
export function liveTranscriptSupported(): boolean {
  return recogniserClass() !== null;
}

export interface LiveTranscript {
  supported: boolean;
  /** Everything recognised so far this answer, settled and provisional together. */
  text: string;
  /** True once the recogniser has actually started listening. */
  listening: boolean;
  start: () => void;
  stop: () => void;
  /** Forget this answer and start the next one clean. */
  reset: () => void;
}

export function useLiveTranscript({ language }: { language: string }): LiveTranscript {
  const [settled, setSettled] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);

  const recogniser = useRef<Recogniser | null>(null);
  // The recogniser stops itself after a pause even in continuous mode, so it has to be
  // restarted — but only while the candidate is still meant to be talking.
  const wanted = useRef(false);

  const stop = useCallback(() => {
    wanted.current = false;
    setListening(false);
    try {
      recogniser.current?.stop();
    } catch {
      // Stopping one that never started throws in some builds and means nothing.
    }
  }, []);

  const start = useCallback(() => {
    const Recognition = recogniserClass();
    if (!Recognition) return;
    wanted.current = true;

    const build = () => {
      const it = new Recognition();
      it.continuous = true;
      it.interimResults = true;
      it.lang = language === "hindi_english" ? "hi-IN" : "en-IN";

      it.onresult = (event) => {
        let addition = "";
        let pending = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;
          if (result.isFinal) addition += result[0].transcript;
          else pending += result[0].transcript;
        }
        if (addition) setSettled((current) => `${current}${addition}`);
        setInterim(pending);
      };

      it.onend = () => {
        // Chrome ends the session on a long pause. A candidate thinking is not a candidate
        // who has finished, so it goes again until the answer is actually over.
        if (!wanted.current) return;
        try {
          it.start();
        } catch {
          setListening(false);
        }
      };

      it.onerror = (event) => {
        // `no-speech` and `aborted` are ordinary; a permission or network failure is not,
        // and there is nothing useful to say about it mid-answer beyond going quiet.
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          wanted.current = false;
          setListening(false);
        }
      };
      return it;
    };

    try {
      recogniser.current = build();
      recogniser.current.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [language]);

  const reset = useCallback(() => {
    setSettled("");
    setInterim("");
  }, []);

  // Leaving the room must not leave a recogniser holding the microphone.
  useEffect(
    () => () => {
      wanted.current = false;
      try {
        recogniser.current?.abort();
      } catch {
        // Already gone.
      }
    },
    [],
  );

  const text = `${settled}${interim}`.replace(/\s+/g, " ").trim();
  return { supported: recogniserClass() !== null, text, listening, start, stop, reset };
}
