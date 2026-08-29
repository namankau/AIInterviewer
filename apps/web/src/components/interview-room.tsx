"use client";

import type { SessionView, TurnView } from "@acemyinterview/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiRequestError, abandonSession, fetchSession, submitAnswer } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import { useInterviewCapture } from "@/lib/use-interview-capture";

type Phase = "loading" | "briefing" | "asking" | "answering" | "submitting" | "complete" | "error";

/**
 * The live interview.
 *
 * Deliberately near-empty (CLAUDE.md): the question, a speaking indicator, a timer, the
 * round label, and a way out. No score ticker, no hints, no gamification — nothing that
 * would tell a candidate mid-answer how they are doing, because a real interview doesn't.
 */
export function InterviewRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const accessToken = useAccessToken();

  const [session, setSession] = useState<SessionView | null>(null);
  const [turn, setTurn] = useState<TurnView | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Consent, and only consent, decides whether the camera opens. Tying this to session
  // status meant a candidate who declined video was recorded anyway (PRD 12).
  const withVideo = session?.consentVideo === true;
  const capture = useInterviewCapture({ withVideo });

  // Load the session, and resume mid-interview if the tab was refreshed.
  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    fetchSession(sessionId, { accessToken })
      .then((loaded) => {
        if (!active) return;
        setSession(loaded);
        setTurn(loaded.currentTurn);
        setPhase(loaded.status === "completed" ? "complete" : loaded.currentTurn ? "briefing" : "complete");
      })
      .catch((cause) => {
        if (!active) return;
        setPhase("error");
        setError(cause instanceof ApiRequestError ? cause.message : "This interview could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [accessToken, sessionId]);

  // Attach the camera preview once devices are open.
  useEffect(() => {
    if (videoRef.current && capture.stream) {
      videoRef.current.srcObject = capture.stream;
    }
  }, [capture.stream, phase]);

  // Answer timer. Reset happens where the answer starts, not here — resetting inside an
  // effect body would cascade an extra render on every phase change.
  useEffect(() => {
    if (phase !== "answering") return;
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  const beginAnswering = useCallback(async () => {
    const started = await capture.start();
    if (started) {
      setElapsed(0);
      setPhase("answering");
    }
  }, [capture]);

  const finishAnswer = useCallback(async () => {
    if (!accessToken || !turn) return;
    const captured = await capture.stop();
    if (!captured) return;

    setPhase("submitting");
    setError(null);
    try {
      const result = await submitAnswer(accessToken, sessionId, turn.turnIndex, captured.audio, captured.video);
      if (result.sessionComplete || !result.nextTurn) {
        capture.release();
        setPhase("complete");
        return;
      }
      setTurn(result.nextTurn);
      setSession((current) =>
        current ? { ...current, turnsCompleted: result.turnsCompleted } : current,
      );
      setPhase("asking");
    } catch (cause) {
      setPhase("error");
      setError(
        cause instanceof ApiRequestError ? cause.message : "That answer could not be submitted.",
      );
    }
  }, [accessToken, capture, sessionId, turn]);

  // Play the spoken question when a new one arrives.
  useEffect(() => {
    if (phase !== "asking" && phase !== "briefing") return;
    const element = audioRef.current;
    if (element && turn?.questionAudioUrl) {
      element.play().catch(() => undefined);
    }
  }, [phase, turn]);

  async function leave() {
    capture.release();
    if (accessToken) {
      await abandonSession(accessToken, sessionId).catch(() => undefined);
    }
    router.push("/dashboard");
  }

  if (phase === "loading") {
    return <Centered role="status">Loading your interview…</Centered>;
  }

  if (phase === "error" && !session) {
    return <Centered role="alert">{error}</Centered>;
  }

  if (phase === "complete") {
    return (
      <Centered>
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          <p className="text-caption tracking-wide text-ink-subtle uppercase">Interview finished</p>
          <h1 className="text-title text-ink">That&rsquo;s the end of the round.</h1>
          <p className="text-body text-ink-muted">
            Your report is being put together from what you actually said.
          </p>
          <a
            href={`/report/${sessionId}`}
            className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
          >
            Read the report
          </a>
        </div>
      </Centered>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-caption tracking-wide text-ink-subtle uppercase">
            {session?.roundLabel}
          </span>
          <span className="text-caption text-ink-subtle">
            {session?.companyName} · {session?.roleTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={leave}
          className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Leave interview
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-12 px-6 py-16">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <SpeakingDot active={phase === "answering"} level={capture.level} />
            <span className="text-caption text-ink-subtle">
              {phase === "answering"
                ? `Recording · ${formatDuration(elapsed)}`
                : phase === "submitting"
                  ? "Thinking…"
                  : "Interviewer"}
            </span>
          </div>

          <p className="text-title text-balance text-ink">{turn?.questionText}</p>

          {turn?.questionAudioUrl ? (
            <audio ref={audioRef} src={turn.questionAudioUrl} controls className="mt-2 w-full max-w-sm" />
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          {phase === "briefing" || phase === "asking" ? (
            <button
              type="button"
              onClick={beginAnswering}
              className="rounded-md bg-accent px-6 py-3 text-body font-medium text-accent-contrast hover:bg-accent-strong"
            >
              Answer
            </button>
          ) : null}

          {phase === "answering" ? (
            <button
              type="button"
              onClick={finishAnswer}
              className="rounded-md border border-accent px-6 py-3 text-body font-medium text-accent hover:bg-surface-sunken"
            >
              Done answering
            </button>
          ) : null}

          {phase === "submitting" ? (
            <p role="status" className="text-body text-ink-muted">
              Listening to your answer…
            </p>
          ) : null}

          <span className="text-caption text-ink-subtle">
            Question {(turn?.turnIndex ?? 0) + 1} of up to {session?.maxTurns}
          </span>
        </div>

        {capture.error ? (
          <p role="alert" className="text-caption text-danger">
            {capture.error}
          </p>
        ) : null}
      </main>

      {withVideo ? (
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          aria-label="Your camera preview"
          className="fixed right-6 bottom-6 h-28 w-36 rounded-lg border border-line bg-surface-sunken object-cover"
        />
      ) : null}
    </div>
  );
}

function SpeakingDot({ active, level }: { active: boolean; level: number }) {
  return (
    <span
      aria-hidden
      className={`size-2.5 rounded-full transition-colors ${active ? "bg-accent" : "bg-ink-subtle"}`}
      style={active ? { transform: `scale(${1 + level * 0.8})` } : undefined}
    />
  );
}

function Centered({ children, role }: { children: React.ReactNode; role?: "status" | "alert" }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div role={role} className="text-body text-ink-muted">
        {children}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
