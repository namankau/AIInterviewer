"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CaptureState = "idle" | "requesting" | "ready" | "recording" | "denied" | "unsupported";

export interface CapturedAnswer {
  audio: Blob;
  video: Blob | null;
  durationMs: number;
}

interface UseInterviewCaptureOptions {
  /** Camera is only opened when the candidate consented to video. */
  withVideo: boolean;
}

/**
 * Microphone and camera capture for one interview.
 *
 * Audio and video are recorded separately from the same device stream: the answer is
 * assessed from clean audio, while the video is stored for body-language analysis later.
 * Recording only ever starts after [start] is called, which the session screen does only
 * once consent has been recorded server-side.
 */
export function useInterviewCapture({ withVideo }: UseInterviewCaptureOptions) {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  // Kept in state as well as a ref: the preview element needs it during render, and a
  // ref read at render time would not trigger the re-render that attaches it.
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** Drives the speaking indicator. Purely cosmetic — never gates recording. */
  const runMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const sample of data) {
        peak = Math.max(peak, Math.abs(sample - 128));
      }
      setLevel(Math.min(1, peak / 64));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const requestDevices = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError("This browser cannot record audio. Try Chrome, Edge or Safari.");
      return null;
    }

    setState("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: withVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false,
      });
      streamRef.current = stream;
      setStream(stream);

      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;

      setState("ready");
      // The meter runs from the moment the device opens, not from the moment recording
      // starts. A candidate checking their microphone before the round needs to see it
      // move to believe it works, which is the whole point of the check.
      runMeter();
      return stream;
    } catch (cause) {
      setState("denied");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was blocked. The interview is spoken, so it cannot run without it."
          : "We could not reach your microphone. Check that no other app is using it.",
      );
      return null;
    }
  }, [runMeter, withVideo]);

  const start = useCallback(async (): Promise<boolean> => {
    const stream = streamRef.current ?? (await requestDevices());
    if (!stream) return false;

    audioChunksRef.current = [];
    videoChunksRef.current = [];

    const audioStream = new MediaStream(stream.getAudioTracks());
    const audioRecorder = new MediaRecorder(audioStream, recorderOptions(AUDIO_TYPES, SPEECH_BITRATE));
    audioRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    audioRecorder.start();
    audioRecorderRef.current = audioRecorder;

    if (withVideo && stream.getVideoTracks().length > 0) {
      const videoRecorder = new MediaRecorder(stream, recorderOptions(VIDEO_TYPES, SPEECH_BITRATE, CAMERA_BITRATE));
      videoRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) videoChunksRef.current.push(event.data);
      };
      videoRecorder.start();
      videoRecorderRef.current = videoRecorder;
    }

    startedAtRef.current = Date.now();
    setState("recording");
    runMeter();
    return true;
  }, [requestDevices, runMeter, withVideo]);

  const stop = useCallback(async (): Promise<CapturedAnswer | null> => {
    const audioRecorder = audioRecorderRef.current;
    if (!audioRecorder) return null;

    const durationMs = Date.now() - startedAtRef.current;
    stopMeter();
    setLevel(0);

    const audio = await finish(audioRecorder, audioChunksRef);
    const video = videoRecorderRef.current ? await finish(videoRecorderRef.current, videoChunksRef) : null;

    audioRecorderRef.current = null;
    videoRecorderRef.current = null;
    setState("ready");

    return { audio, video, durationMs };
  }, [stopMeter]);

  /** Releases the camera light and the microphone. Called on unmount and on exit. */
  const release = useCallback(() => {
    stopMeter();
    audioRecorderRef.current?.stop();
    videoRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close().catch(() => undefined);
    streamRef.current = null;
    audioRecorderRef.current = null;
    videoRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setStream(null);
    setState("idle");
  }, [stopMeter]);

  useEffect(() => release, [release]);

  return {
    state,
    error,
    level,
    stream,
    requestDevices,
    start,
    stop,
    release,
    isRecording: state === "recording",
  };
}

const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
const VIDEO_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

/**
 * Opus, mono, speech. Well above what the model needs to transcribe an answer or hear how
 * it was delivered, and a quarter of what the browser picks on its own.
 */
const SPEECH_BITRATE = 48_000;

/**
 * The camera is recorded for a body-language analysis that does not exist yet — the
 * product decision is to capture it now and analyse it later — so it only has to be good
 * enough to read posture and eye contact from, later, and not good enough to look at.
 *
 * Left to itself Chromium encodes VP9 at roughly 4.4 MB per minute of answer, measured
 * against its own capture device on a synthetic pattern that compresses better than a real
 * person in a room. None of that is uploaded until the candidate stops talking, so on a
 * 5 Mbps home uplink it is about seven seconds of the pause between their last word and
 * the next question, before the model has been asked anything at all. At 300 kbps it is
 * 1.6 MB per minute and under three seconds.
 */
const CAMERA_BITRATE = 300_000;

/**
 * Safari and Chrome disagree on supported containers; take the first that works.
 *
 * The bitrates are set explicitly because the default is chosen for watching, and nobody
 * watches these. Every byte is one the candidate waits to upload.
 */
function recorderOptions(candidates: string[], audioBps: number, videoBps?: number): MediaRecorderOptions {
  if (typeof MediaRecorder === "undefined") return {};
  const supported = candidates.find((type) => MediaRecorder.isTypeSupported(type));
  return {
    ...(supported ? { mimeType: supported } : {}),
    audioBitsPerSecond: audioBps,
    ...(videoBps === undefined ? {} : { videoBitsPerSecond: videoBps }),
  };
}

function finish(recorder: MediaRecorder, chunks: React.RefObject<Blob[]>): Promise<Blob> {
  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks.current, { type: recorder.mimeType || "application/octet-stream" }));
    };
    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      resolve(new Blob(chunks.current));
    }
  });
}
