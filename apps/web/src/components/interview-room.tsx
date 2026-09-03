"use client";

import type { HintView, SessionView, TurnView } from "@acemyinterview/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DeviceCheck } from "@/components/device-check";
import {
  ApiRequestError,
  abandonSession,
  fetchSession,
  requestHint,
  submitAnswer,
} from "@/lib/api";
import { initialSilenceState, observe, shouldEnd } from "@/lib/silence";
import { useAccessToken } from "@/lib/use-access-token";
import { useInterviewCapture } from "@/lib/use-interview-capture";
import { useQuestionAudio } from "@/lib/use-question-audio";

type Phase =
  | "loading"
  | "checking"
  | "asking"
  | "answering"
  | "submitting"
  | "complete"
  | "error";

/**
 * The live interview.
 *
 * Deliberately near-empty (CLAUDE.md): the question, a speaking indicator, the round
 * clock, and a way out. No score ticker, no running feedback, nothing that tells a
 * candidate mid-answer how they are doing — a real interview does not.
 *
 * Two controls earn their place beside those. The answer ends itself on silence, because
 * pressing a button when you stop talking is the tell that this is a form rather than a
 * conversation. And help can be asked for, because a candidate frozen on a question has
 * no realistic move otherwise — a real interviewer nudges. Asking is recorded, and the
 * room says so before they ask rather than after.
 */
export function InterviewRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const accessToken = useAccessToken();

  const [session, setSession] = useState<SessionView | null>(null);
  const [turn, setTurn] = useState<TurnView | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState<HintView | null>(null);
  const [hintPending, setHintPending] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Consent, and only consent, decides whether the camera opens. Tying this to session
  // status meant a candidate who declined video was recorded anyway (PRD 12).
  const withVideo = session?.consentVideo === true;
  const capture = useInterviewCapture({ withVideo });
  const questionAudio = useQuestionAudio({ sessionId, turn, accessToken });

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    fetchSession(sessionId, { accessToken })
      .then((loaded) => {
        if (!active) return;
        setSession(loaded);
        setTurn(loaded.currentTurn);
        setPhase(
          loaded.status === "completed" || !loaded.currentTurn ? "complete" : "checking",
        );
      })
      .catch((cause) => {
        if (!active) return;
        setPhase("error");
        setError(
          cause instanceof ApiRequestError ? cause.message : "This interview could not be loaded.",
        );
      });

    return () => {
      active = false;
    };
  }, [accessToken, sessionId]);

  useEffect(() => {
    if (videoRef.current && capture.stream) {
      videoRef.current.srcObject = capture.stream;
    }
  }, [capture.stream, phase]);

  const finishAnswer = useCallback(async () => {
    if (!accessToken || !turn) return;
    const captured = await capture.stop();
    if (!captured) return;

    setPhase("submitting");
    setError(null);
    try {
      const result = await submitAnswer(
        accessToken,
        sessionId,
        turn.turnIndex,
        captured.audio,
        captured.video,
      );
      if (result.sessionComplete || !result.nextTurn) {
        capture.release();
        setPhase("complete");
        return;
      }
      setHint(null);
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

  // The meter and the submit callback are read through refs by the tick below. The
  // meter changes on every animation frame, and rebuilding the interval each time would
  // throw away the silence it has accumulated and mean an answer never ended itself.
  const latest = useRef({ level: capture.level, finish: finishAnswer });
  useEffect(() => {
    latest.current = { level: capture.level, finish: finishAnswer };
  });

  // The answer timer and the silence that ends the answer run off one tick, so a reading
  // and the timestamp it is judged against cannot disagree.
  useEffect(() => {
    if (phase !== "answering") return;
    const startedAt = Date.now();
    let silence = initialSilenceState;
    let ended = false;

    const id = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startedAt) / 1000));
      silence = observe(silence, latest.current.level, now);
      if (!ended && shouldEnd(silence, now, startedAt)) {
        ended = true;
        void latest.current.finish();
      }
    }, 200);

    return () => clearInterval(id);
  }, [phase]);

  const beginAnswering = useCallback(async () => {
    const started = await capture.start();
    if (started) {
      setElapsed(0);
      setPhase("answering");
    }
  }, [capture]);

  const askForHint = useCallback(async () => {
    if (!accessToken || !turn || hintPending) return;
    setHintPending(true);
    setError(null);
    try {
      setHint(await requestHint(accessToken, sessionId, turn.turnIndex));
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "The interviewer could not be reached for that.",
      );
    } finally {
      setHintPending(false);
    }
  }, [accessToken, hintPending, sessionId, turn]);

  // Autoplay with sound is refused until the document has been interacted with. Entering
  // the room is that interaction, which is most of why the antechamber exists — but a
  // refusal is still surfaced rather than swallowed, because silence with no explanation
  // is how the interviewer stayed mute for a whole release.
  useEffect(() => {
    if (phase !== "asking") return;
    const element = audioRef.current;
    if (!element || !questionAudio.url) return;
    setAudioBlocked(false);
    element.play().catch(() => setAudioBlocked(true));
  }, [phase, questionAudio.url]);

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
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Interview finished
          </p>
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

  if (phase === "checking" && session) {
    return <DeviceCheck session={session} capture={capture} onEnter={() => setPhase("asking")} />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            {session?.roundLabel}
          </span>
          <span className="text-caption text-ink-subtle">
            {session?.companyName} · {session?.roleTitle}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <RoundClock endsAt={session?.scheduledEndAt ?? null} phase={turn?.phase} />
          <button
            type="button"
            onClick={leave}
            className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Leave interview
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <SpeakingDot active={phase === "answering"} level={capture.level} />
            <span className="text-caption text-ink-subtle" role="status">
              {phase === "answering"
                ? `Listening · ${formatDuration(elapsed)}`
                : phase === "submitting"
                  ? "Thinking about that…"
                  : "Interviewer"}
            </span>
          </div>

          <p className="text-title text-balance text-ink">{turn?.questionText}</p>

          {questionAudio.url ? (
            <div className="flex flex-col gap-2">
              <audio ref={audioRef} src={questionAudio.url} controls className="w-full max-w-sm" />
              {audioBlocked ? (
                <p className="text-caption text-ink-subtle">
                  Your browser held the audio back — press play, or just read the question and
                  answer.
                </p>
              ) : null}
            </div>
          ) : questionAudio.status === "pending" ? (
            <p className="text-caption text-ink-subtle" role="status">
              The interviewer is about to say this aloud. You can start answering now.
            </p>
          ) : null}
        </div>

        {hint ? (
          <aside className="rounded-lg border border-line bg-accent-wash px-5 py-4">
            <p className="pb-1.5 font-mono text-micro tracking-widest text-ink-subtle uppercase">
              You asked for help · recorded as &ldquo;{hint.assistanceLabel.toLowerCase()}&rdquo;
            </p>
            <p className="text-body text-ink">{hint.text}</p>
          </aside>
        ) : null}

        {error ? (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          {phase === "asking" ? (
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

          {!hint && (phase === "asking" || phase === "answering") ? (
            <button
              type="button"
              onClick={askForHint}
              disabled={hintPending}
              className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
            >
              {hintPending ? "Asking…" : "I'm stuck — give me a nudge"}
            </button>
          ) : null}
        </div>

        <p className="text-caption text-ink-subtle">
          {phase === "answering"
            ? "Stop talking and the interviewer moves on. Pausing to think is fine."
            : "Asking for a nudge is allowed once per question, and the report records that you did."}
        </p>

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

/**
 * Counts down to the server's deadline, not to a clock of its own — a drifting tab or a
 * sleeping laptop must not buy the candidate extra time.
 */
function RoundClock({ endsAt, phase }: { endsAt: string | null; phase?: TurnView["phase"] }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const deadline = new Date(endsAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (remaining === null) return null;

  return (
    <span className="flex items-baseline gap-2">
      {phase ? (
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {phase === "warmup" ? "Warm-up" : phase === "closing" ? "Closing" : "Main round"}
        </span>
      ) : null}
      <span
        className="font-mono text-caption text-ink-muted tabular-nums"
        aria-label={`${Math.ceil(remaining / 60)} minutes left in this round`}
      >
        {formatDuration(remaining)}
      </span>
    </span>
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
