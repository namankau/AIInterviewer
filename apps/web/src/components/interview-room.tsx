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
import { initialSilenceState, observe, shouldEnd, SPEECH_LEVEL } from "@/lib/silence";
import { revealedText } from "@/lib/spoken-text";
import { useAccessToken } from "@/lib/use-access-token";
import { InterviewerPresence, type PresenceState } from "@/components/interviewer-presence";
import { useBackchannel } from "@/lib/use-backchannel";
import { useInterviewCapture } from "@/lib/use-interview-capture";
import { useQuestionAudio } from "@/lib/use-question-audio";

/**
 * How long the voice gets to arrive before the question goes up in writing anyway.
 *
 * Deliberately long, and that is the interesting decision here. Measured end to end
 * against live Gemini, the next question's *text* is ready about 4s after an answer and
 * its *voice* about 14s. Speech latency is the model's, not ours: it is roughly 5s for a
 * sentence and 14s for a paragraph, and splitting a question into parallel calls (see
 * SpeechChunks) took it from 17.7s to 14s and no further.
 *
 * A short window therefore did the opposite of what it was for. The text would go up at
 * 6s, the voice would arrive at 14s and read out something already on screen — exactly
 * the mismatch this was meant to fix.
 *
 * So the room waits, and covers the wait honestly: the interviewer says "let me think
 * about that" the moment the candidate stops, and the room shows it is thinking. A pause
 * before a question, with an audible acknowledgement in it, is what a real interviewer
 * does. Text arriving ten seconds before the voice is not.
 *
 * This falls back rather than hanging: speech that genuinely failed comes back
 * `unavailable` and the question is shown immediately.
 */
const VOICE_GRACE_MS = 25_000;

/**
 * How long a candidate gets to read a question that has no voice, before the microphone
 * opens. Long enough to read a couple of sentences without feeling rushed.
 */
const READING_TIME_MS = 4_000;

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
  const backchannel = useBackchannel({ enabled: phase === "answering" || phase === "submitting" });

  /*
   * The question appears as it is spoken, not before it.
   *
   * Reading a question, waiting, and then being read it back is worse than either alone:
   * it breaks the sense that anyone is talking to you, and it invites an answer to a
   * question the interviewer has not finished asking.
   *
   * But syncing unconditionally would be worse still. Speech takes a few seconds to
   * render, and holding the text until it lands would leave the candidate looking at an
   * empty room — so the voice only gets to lead if it arrives promptly. Past that, the
   * question goes up in writing and stays up, which is the behaviour this replaced.
   */
  const questionText = turn?.questionText ?? "";
  const turnIndex = turn?.turnIndex ?? null;

  // Both of these carry the turn they belong to, and a mismatch reads as "not yet"
  // during the same render. Clearing them in an effect instead would show one frame of
  // the previous question's progress against the new question's text.
  const [progress, setProgress] = useState({ turnIndex: -1, currentTime: 0, duration: 0 });
  const [lateFor, setLateFor] = useState<number | null>(null);

  useEffect(() => {
    if (turnIndex === null) return;
    const timer = setTimeout(() => setLateFor(turnIndex), VOICE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [turnIndex]);

  const withinGrace = lateFor !== turnIndex;
  /** The voice is still rendering and has not used up its head start. Hold the text. */
  /*
   * What the figure opposite is doing. "asking" with a voice still rendering is thinking
   * rather than speaking — the candidate should not watch a mouth move in silence.
   */
  const presenceState: PresenceState =
    phase === "answering"
      ? "listening"
      : phase === "submitting"
        ? "thinking"
        : phase === "asking"
          ? questionAudio.status === "pending"
            ? "thinking"
            : "speaking"
          : "waiting";

  const awaitingVoice = questionAudio.status === "pending" && withinGrace;
  const voiceLeads = questionAudio.status === "ready" && !!questionAudio.url && withinGrace;
  const spoken = progress.turnIndex === turnIndex ? progress : { currentTime: 0, duration: 0 };

  const visibleQuestion = awaitingVoice
    ? ""
    : voiceLeads
      ? revealedText(questionText, spoken.currentTime, spoken.duration)
      : // No voice is coming, or it took too long to wait for. Better an unsynced
        // question than an empty room.
        questionText;

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
    // Said the moment they stop, while the model is still reading the answer. This is
    // the one that does the most work: it turns a dead ten-second gap into someone who
    // heard you and is thinking about it.
    backchannel.acknowledge();
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
  }, [accessToken, backchannel, capture, sessionId, turn]);

  // The meter and the submit callback are read through refs by the tick below. The
  // meter changes on every animation frame, and rebuilding the interval each time would
  // throw away the silence it has accumulated and mean an answer never ended itself.
  const latest = useRef({ level: capture.level, finish: finishAnswer, backchannel });
  useEffect(() => {
    latest.current = { level: capture.level, finish: finishAnswer, backchannel };
  });

  // The answer timer and the silence that ends the answer run off one tick, so a reading
  // and the timestamp it is judged against cannot disagree.
  useEffect(() => {
    if (phase !== "answering") return;
    const startedAt = Date.now();
    let silence = initialSilenceState;
    let ended = false;

    const TICK_MS = 200;
    const id = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startedAt) / 1000));

      if (latest.current.backchannel.speaking) {
        // The interviewer is making a listening noise. Echo cancellation should keep it
        // out of the microphone, but "should" is not a basis for deciding that someone
        // has stopped talking — so the silence clock pauses rather than reading a meter
        // that may be hearing us. Whatever silence had accrued is kept.
        if (silence.silentSince !== null) {
          silence = { ...silence, silentSince: silence.silentSince + TICK_MS };
        }
        return;
      }

      latest.current.backchannel.observe(latest.current.level, SPEECH_LEVEL);
      silence = observe(silence, latest.current.level, now);
      if (!ended && shouldEnd(silence, now, startedAt)) {
        ended = true;
        void latest.current.finish();
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [phase]);

  const beginAnswering = useCallback(async () => {
    const started = await capture.start();
    if (started) {
      setElapsed(0);
      backchannel.reset();
      setPhase("answering");
    }
  }, [backchannel, capture]);

  /*
   * The floor passes to the candidate on its own.
   *
   * A real interviewer stops talking and you answer; there is no moment where you press
   * something first. So the microphone opens when the question finishes being spoken —
   * or, when there is no voice to wait for, after a beat long enough to read it.
   *
   * `beginAnswering` is read through a ref rather than depended on: it changes identity
   * whenever the capture hook re-renders, and re-running this effect would re-open the
   * microphone mid-answer.
   */
  const handOver = useRef(beginAnswering);
  useEffect(() => {
    handOver.current = beginAnswering;
  });

  useEffect(() => {
    if (phase !== "asking") return;

    const element = audioRef.current;
    // A question with a voice hands over when the voice stops.
    if (questionAudio.status === "ready" && element) {
      const start = () => void handOver.current();
      element.addEventListener("ended", start, { once: true });
      return () => element.removeEventListener("ended", start);
    }

    // No voice is coming, so the candidate is reading. Give them time to, then listen.
    if (questionAudio.status === "unavailable") {
      const timer = setTimeout(() => void handOver.current(), READING_TIME_MS);
      return () => clearTimeout(timer);
    }

    // Still rendering. This effect re-runs when that resolves.
    return undefined;
  }, [phase, questionAudio.status, questionAudio.url]);

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

  /*
   * The question is revealed in step with the voice reading it, so `timeupdate` drives
   * the text. It fires about four times a second, which is enough for a reveal that is
   * meant to feel like speech rather than a typewriter.
   *
   * `ended` matters as much as the ticks: a browser that stops firing `timeupdate`
   * slightly before the end would otherwise leave the last word or two permanently
   * withheld.
   */
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const at = (currentTime: number, duration: number) =>
      setProgress({ turnIndex: turnIndex ?? -1, currentTime, duration });
    const sync = () => at(element.currentTime, element.duration);
    // `ended` matters as much as the ticks: a browser that stops firing `timeupdate`
    // just short of the end would otherwise withhold the last word for good.
    const finish = () => at(element.duration || 1, element.duration || 1);

    element.addEventListener("timeupdate", sync);
    element.addEventListener("loadedmetadata", sync);
    element.addEventListener("ended", finish);
    return () => {
      element.removeEventListener("timeupdate", sync);
      element.removeEventListener("loadedmetadata", sync);
      element.removeEventListener("ended", finish);
    };
  }, [questionAudio.url, turnIndex]);

  const replayQuestion = useCallback(() => {
    const element = audioRef.current;
    if (!element) return;
    element.currentTime = 0;
    setAudioBlocked(false);
    element.play().catch(() => setAudioBlocked(true));
  }, []);

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
          <div className="flex items-center justify-between gap-4">
            <InterviewerPresence state={presenceState} level={capture.level} />
            {phase === "answering" ? (
              <span className="flex items-center gap-2 font-mono text-caption text-ink-subtle">
                <SpeakingDot active level={capture.level} />
                {formatDuration(elapsed)}
              </span>
            ) : null}
          </div>

          {/*
            * The question appears as it is spoken. `aria-live` is deliberately absent:
            * a screen reader announcing every partial reveal would be unusable, and the
            * full text is always present in the DOM for assistive technology below.
            */}
          <p className="text-title text-balance text-ink">
            {awaitingVoice ? (
              <span className="text-ink-subtle">Composing the next question…</span>
            ) : (
              <>
                {visibleQuestion}
                {visibleQuestion.length < questionText.length ? (
                  <span aria-hidden className="animate-pulse text-ink-subtle">
                    {" "}
                    ▍
                  </span>
                ) : null}
              </>
            )}
          </p>
          {/*
            * Assistive technology gets the whole question as soon as it exists, rather
            * than being made to sit through a reveal paced for the ear.
            */}
          <p className="sr-only">{questionText}</p>

          {questionAudio.url ? (
            <div className="flex flex-col gap-2">
              {/* No `controls`: scrubbing an interviewer is not a thing you can do. */}
              <audio ref={audioRef} src={questionAudio.url} className="hidden" />
              <button
                type="button"
                onClick={replayQuestion}
                className="self-start text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                {audioBlocked ? "Play the question" : "Say that again"}
              </button>
              {audioBlocked ? (
                <p className="text-caption text-ink-subtle">
                  Your browser held the audio back — press play, or just read the question and
                  answer.
                </p>
              ) : null}
            </div>
          ) : questionAudio.status === "pending" ? (
            <p className="text-caption text-ink-subtle" role="status">
              The interviewer is working out what to ask next.
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

        {/*
          * No "Answer" button and no "Done answering" button.
          *
          * Both were the tell that this is a form rather than a conversation: nobody
          * presses a key to begin speaking to a person, and nobody announces that they
          * have finished. The room now opens the microphone as soon as the interviewer
          * stops talking, and closes it when the candidate does — see the effects above
          * and silence.ts. What is left here is the one control a real candidate would
          * actually want, which is a way to ask for help.
          */}
        <div className="flex flex-wrap items-center gap-4">
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
            ? "Just start talking. Stop, and the interviewer moves on — pausing to think is fine."
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
