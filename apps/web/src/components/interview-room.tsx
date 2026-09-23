"use client";

import type { BoardState, HintView, SessionView, TurnView } from "@acemyinterview/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DesignWorkspace } from "@/components/design-workspace";
import { DeviceCheck } from "@/components/device-check";
import { DsaWorkspace } from "@/components/dsa-workspace";
import { RoundClock, formatDuration } from "@/components/round-clock";
import {
  ApiRequestError,
  abandonSession,
  beginSession,
  fetchSession,
  finishSession,
  requestHint,
  saveBoard,
  submitAnswer,
} from "@/lib/api";
import { initialSilenceState, observe, shouldEnd } from "@/lib/silence";
import { revealedText } from "@/lib/spoken-text";
import { useBrowserVoice } from "@/lib/use-browser-voice";
import { useLiveTranscript } from "@/lib/use-live-transcript";
import { useAccessToken } from "@/lib/use-access-token";
import { InterviewerPresence, type PresenceState } from "@/components/interviewer-presence";
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

/** How long the board sits still before it is saved. One second of drawing, at most, is lost. */
const BOARD_SAVE_MS = 1_000;

/** How often the design rail re-checks which phase the round is in. */
const ROUND_CLOCK_TICK_MS = 10_000;

/**
 * How long a candidate gets to read a question that has no voice, before the microphone
 * opens. Long enough to read a couple of sentences without feeling rushed.
 */
const READING_TIME_MS = 4_000;

/**
 * The longest one unbroken turn runs in a room with a workspace before the interviewer
 * comes in on their own.
 *
 * Silence does not end a turn there — people go quiet to type and draw — so without a
 * ceiling a candidate who never hands over would be recorded for the whole round in one
 * take. Ten minutes is where a real interviewer checks in anyway, and it keeps one take at
 * about 3.6 MB, far inside what the model accepts in a single request.
 */
const LONGEST_WORKSPACE_TAKE_MS = 10 * 60_000;

type Phase =
  | "loading"
  | "checking"
  | "asking"
  | "answering"
  | "submitting"
  /** The interviewer is saying goodbye. A round ends with somebody saying it has. */
  | "closing"
  | "complete"
  | "terminal"
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
  const [entering, setEntering] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answerRequestIds = useRef(new Map<number, string>());
  const hintRequestIds = useRef(new Map<number, string>());

  // Consent, and only consent, decides whether the camera opens. Tying this to session
  // status meant a candidate who declined video was recorded anyway (PRD 12).
  const withVideo = session?.consentVideo === true;
  const capture = useInterviewCapture({ withVideo });
  /*
   * The interviewer speaks locally when the browser has a voice worth using: instantly,
   * for nothing, and reporting where in the sentence it has reached — which is the sync
   * the reveal has been approximating with a timer. The model's recording is the fallback,
   * not the default. See use-browser-voice.ts.
   */
  const browserVoice = useBrowserVoice({ language: session?.language ?? "english" });
  /* A mirror of what the candidate is saying. Never sent anywhere; see use-live-transcript.ts. */
  const liveTranscript = useLiveTranscript({ language: session?.language ?? "english" });
  const questionAudio = useQuestionAudio({ sessionId, turn, accessToken });

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
  const [closingRemark, setClosingRemark] = useState<string | null>(null);

  useEffect(() => {
    if (turnIndex === null) return;
    const timer = setTimeout(() => setLateFor(turnIndex), VOICE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [turnIndex]);

  const withinGrace = lateFor !== turnIndex;
  /** The voice is still rendering and has not used up its head start. Hold the text. */
  const speaksLocally = browserVoice.available;
  /**
   * A DSA or design room: the candidate works on something on screen, and going quiet to
   * type or draw is the work, not the end of an answer.
   */
  const hasWorkspace = session?.workspace != null;

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
          ? speaksLocally
            ? browserVoice.speaking
              ? "speaking"
              : "thinking"
            : questionAudio.status === "pending"
              ? "thinking"
              : "speaking"
          : "waiting";

  const awaitingVoice = !speaksLocally && questionAudio.status === "pending" && withinGrace;
  const voiceLeads = questionAudio.status === "ready" && !!questionAudio.url && withinGrace;
  const spoken = progress.turnIndex === turnIndex ? progress : { currentTime: 0, duration: 0 };

  const visibleQuestion = speaksLocally
    ? browserVoice.saying === questionText
      ? questionText.slice(0, browserVoice.spokenChars)
      : browserVoice.said === questionText
        ? // Read to the end, or the utterance failed. Either way the question stands.
          questionText
        : // Asked for, not started. A word appearing before the voice reaches it is the
          // thing this whole mechanism exists to prevent.
          ""
    : awaitingVoice
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
        if (loaded.status === "completed") {
          setPhase("complete");
        } else if (loaded.status === "in_progress" && loaded.currentTurn) {
          setPhase("checking");
        } else {
          setPhase("terminal");
        }
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

  /*
   * The round has ended — by the clock, by the interviewer, or by the candidate pressing
   * Submit. However it ended, it ends the same way: somebody says so, then the screen
   * changes.
   */
  const closeRound = useCallback(
    (closing: string | null) => {
      capture.release();
      if (closing) {
        setClosingRemark(closing);
        setPhase("closing");
        if (speaksLocally) {
          browserVoice.say(closing, () => setPhase("complete"));
        } else {
          window.setTimeout(() => setPhase("complete"), READING_TIME_MS * 2);
        }
        return;
      }
      setPhase("complete");
    },
    [browserVoice, capture, speaksLocally],
  );

  const finishAnswer = useCallback(async (endRound = false) => {
    if (!accessToken || !turn) return;
    const captured = await capture.stop();
    if (!captured) return;

    liveTranscript.stop();
    setPhase("submitting");
    setError(null);
    const requestId = answerRequestIds.current.get(turn.turnIndex) ?? crypto.randomUUID();
    answerRequestIds.current.set(turn.turnIndex, requestId);
    try {
      const result = await submitAnswer(
        accessToken,
        sessionId,
        turn.turnIndex,
        captured.audio,
        requestId,
        speaksLocally,
        endRound,
      );
      answerRequestIds.current.delete(turn.turnIndex);
      if (result.sessionComplete || !result.nextTurn) {
        /*
         * A round ends with somebody saying it has.
         *
         * It used to end by the page changing: the candidate gave an answer and the room
         * replaced itself, with no goodbye and no way to tell a finished interview from a
         * crashed one. The remark is spoken first, and only when it has been said does
         * the completion screen appear.
         *
         * With no voice available the text still shows, and `onDone` fires from the
         * speech watchdog, so the screen is never held by a voice that is not coming.
         */
        closeRound(result.closingRemark ?? null);
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
  }, [accessToken, capture, closeRound, liveTranscript, sessionId, speaksLocally, turn]);

  // The meter and the submit callback are read through refs by the tick below. The
  // meter changes on every animation frame, and rebuilding the interval each time would
  // throw away the silence it has accumulated and mean an answer never ended itself.
  const latest = useRef({ level: capture.level, finish: finishAnswer });
  useEffect(() => {
    latest.current = { level: capture.level, finish: finishAnswer };
  });

  // The answer timer and the silence that ends the answer run off one tick, so a reading
  // and the timestamp it is judged against cannot disagree.
  //
  // Except in a room with a workspace, where silence ends nothing. Three and a half
  // seconds of quiet is the end of a spoken answer and the middle of typing a loop, and
  // treating it as an ending had the interviewer cut in with "let me stop you there" on a
  // candidate who was simply writing code. There, the candidate hands over when they want
  // the interviewer — "Over to you" — or the clock or the take ceiling does.
  useEffect(() => {
    if (phase !== "answering") return;
    const startedAt = Date.now();
    let silence = initialSilenceState;
    let ended = false;

    const TICK_MS = 200;
    const id = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startedAt) / 1000));

      silence = observe(silence, latest.current.level, now);
      const over = hasWorkspace ? now - startedAt >= LONGEST_WORKSPACE_TAKE_MS : shouldEnd(silence, now, startedAt);
      if (!ended && over) {
        ended = true;
        void latest.current.finish();
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [phase, hasWorkspace]);

  const beginAnswering = useCallback(async () => {
    const started = await capture.start();
    if (started) {
      setElapsed(0);
      // A clean slate per answer: the previous one's words must not appear under this one.
      liveTranscript.reset();
      liveTranscript.start();
      setPhase("answering");
    }
  }, [capture, liveTranscript]);

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

  /*
   * Read the question out locally, once per turn, and hand the floor over when the voice
   * actually stops — which the browser tells us, rather than being inferred from a
   * recording's duration or a reading-speed guess.
   */
  useEffect(() => {
    if (phase !== "asking" || !speaksLocally || !questionText) return;
    // Already reading it, or already read it. Neither is a reason to start again.
    if (browserVoice.saying === questionText || browserVoice.said === questionText) return;
    browserVoice.say(questionText, () => void handOver.current());
  }, [browserVoice, phase, questionText, speaksLocally]);

  useEffect(() => {
    if (phase !== "asking" || speaksLocally) return;

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
  }, [phase, questionAudio.status, questionAudio.url, speaksLocally]);

  const askForHint = useCallback(async () => {
    if (!accessToken || !turn || hintPending) return;
    setHintPending(true);
    setError(null);
    const requestId = hintRequestIds.current.get(turn.turnIndex) ?? crypto.randomUUID();
    hintRequestIds.current.set(turn.turnIndex, requestId);
    try {
      setHint(await requestHint(accessToken, sessionId, turn.turnIndex, requestId));
      hintRequestIds.current.delete(turn.turnIndex);
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

  /*
   * The board, saved as they work.
   *
   * Debounced because Excalidraw fires on every pointer move and a PUT per stroke would
   * be absurd. Failures are swallowed on purpose: a save that missed is replaced by the
   * next one a second later, and interrupting somebody mid-design to tell them about a
   * transient network blip would cost far more than it saved.
   */
  const boardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBoard = useRef<BoardState | null>(null);
  useEffect(() => () => { if (boardTimer.current) clearTimeout(boardTimer.current); }, []);

  const onBoardChange = useCallback(
    (next: BoardState) => {
      latestBoard.current = next;
      if (!accessToken || boardTimer.current) return;
      boardTimer.current = setTimeout(() => {
        boardTimer.current = null;
        const board = latestBoard.current;
        if (board) void saveBoard(accessToken, sessionId, board).catch(() => undefined);
      }, BOARD_SAVE_MS);
    },
    [accessToken, sessionId],
  );

  const workspace = session?.workspace ?? null;

  /*
   * Minutes into the round, for the design rail. Advisory only — it paces the candidate,
   * it does not gate anything.
   *
   * Ticked from an effect rather than read during render: the clock is not a pure
   * function of props, and the React compiler is right to say so. Starting at zero is
   * correct rather than a compromise — a round that has just begun is in Requirements.
   */
  const [minutesElapsed, setMinutesElapsed] = useState(0);
  const startedAt = session?.startedAt ?? null;
  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const timer = setInterval(
      () => setMinutesElapsed(Math.max(0, Math.floor((Date.now() - start) / 60_000))),
      ROUND_CLOCK_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [startedAt]);

  const workspaceNode =
    workspace === null ? null : workspace.kind === "dsa" ? (
      <DsaWorkspace problem={workspace.problem} board={session?.board ?? null} onBoardChange={onBoardChange} />
    ) : (
      <DesignWorkspace
        designCase={workspace.case}
        board={session?.board ?? null}
        minutesElapsed={minutesElapsed}
        durationMinutes={session?.durationMinutes ?? 45}
        onBoardChange={onBoardChange}
      />
    );

  /*
   * Two ways out, and they are not the same thing.
   *
   * Submit completes the round: whatever has been answered is assessed and the report is
   * written, exactly as if the clock had run out. Pressed mid-answer, the answer being
   * given is submitted as the last one rather than thrown away.
   *
   * Leave forfeits it: no report, and it is not counted as practice. That is a real loss,
   * so it is confirmed rather than one stray click away.
   */
  const answeredSoFar = session?.turnsCompleted ?? 0;
  const canSubmit =
    (phase === "answering" || ((phase === "asking" || phase === "error") && answeredSoFar > 0)) && !!accessToken;

  async function submitAndFinish() {
    if (!accessToken) return;
    if (phase === "answering") {
      await finishAnswer(true);
      return;
    }
    setPhase("submitting");
    setError(null);
    browserVoice.cancel();
    try {
      const result = await finishSession(accessToken, sessionId);
      closeRound(result.closingRemark ?? null);
    } catch (cause) {
      setPhase("error");
      setError(cause instanceof ApiRequestError ? cause.message : "The interview could not be submitted.");
    }
  }

  /*
   * The clock ends the round — on the candidate's screen, when it says 0:00.
   *
   * It used to be enforced only when the next answer arrived at the server, so a round
   * whose clock ran out mid-answer simply carried on: one five-minute round ran to 7:17
   * with the clock sat at zero. Now the room ends it itself. The answer in progress is
   * submitted as the last one — it is assessed, not thrown away — and the interviewer
   * says time is up.
   *
   * Level-triggered on purpose: an answer still being assessed at 0:00 can come back
   * with another question, and that question must end the round too rather than open
   * the microphone on a round that is over. One automatic attempt; if it fails, Submit is
   * still there.
   */
  const [timeUp, setTimeUp] = useState(false);
  const endingForTime = useRef(false);
  const endForTime = useRef<() => void>(() => undefined);
  useEffect(() => {
    endForTime.current = () => {
      if (endingForTime.current) return;
      if (phase === "answering") {
        endingForTime.current = true;
        void finishAnswer(true);
      } else if ((phase === "asking" || phase === "error") && answeredSoFar > 0) {
        endingForTime.current = true;
        void submitAndFinish();
      }
    };
  });
  useEffect(() => {
    if (timeUp) endForTime.current();
  }, [timeUp, phase]);

  /*
   * Walking into the room is what starts the clock.
   *
   * It used to start when the session row was written — before the problem had been
   * composed, before the device check, before the candidate had read a word — so a
   * five-minute round opened on 3:50. The server starts it once; a reload mid-round
   * finds it already running and changes nothing.
   */
  async function enterRoom() {
    if (!accessToken || entering) return;
    setEntering(true);
    setError(null);
    try {
      const view = await beginSession(accessToken, sessionId);
      setSession((current) =>
        current
          ? { ...current, startedAt: view.startedAt, scheduledEndAt: view.scheduledEndAt }
          : current,
      );
      setPhase("asking");
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "This interview could not be started. Check your connection and try again.",
      );
    } finally {
      setEntering(false);
    }
  }

  async function leave() {
    const confirmed = window.confirm(
      "Leave this interview?\n\nIt will be counted as forfeited: nothing you have said is assessed " +
        "and there will be no report. To end early and still get your report, use Submit instead.",
    );
    if (!confirmed) return;
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

  if (phase === "closing") {
    return (
      <Centered>
        <div className="flex max-w-md flex-col items-center gap-6 text-center">
          <InterviewerPresence state={browserVoice.speaking ? "speaking" : "waiting"} level={0} />
          <p className="text-title text-balance text-ink">{closingRemark}</p>
        </div>
      </Centered>
    );
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

  if (phase === "terminal" && session) {
    return <TerminalSession session={session} />;
  }

  if (phase === "checking" && session) {
    return (
      <DeviceCheck
        session={session}
        capture={capture}
        onEnter={() => void enterRoom()}
        entering={entering}
        entryError={error}
      />
    );
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
          <RoundClock endsAt={session?.scheduledEndAt ?? null} phase={turn?.phase} onExpired={() => setTimeUp(true)} />
          <button
            type="button"
            onClick={() => void submitAndFinish()}
            disabled={!canSubmit}
            title={
              canSubmit
                ? "End the round now and get your report"
                : "Answer at least one question before submitting"
            }
            className="rounded-md bg-accent px-3 py-1.5 text-caption font-medium text-accent-contrast transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit and finish
          </button>
          <button
            type="button"
            onClick={() => void leave()}
            className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Leave (forfeit)
          </button>
        </div>
      </header>

      <div className={workspace ? "flex min-h-0 flex-1 flex-col lg:flex-row" : "contents"}>
        {workspace ? <div className="min-h-0 flex-1 border-line lg:border-r">{workspaceNode}</div> : null}

      <main
        className={
          workspace
            ? "flex w-full shrink-0 flex-col gap-6 overflow-y-auto px-6 py-8 lg:w-[24rem]"
            : "mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16"
        }
      >
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
          ) : questionAudio.status === "unavailable" ? (
            /*
             * Said out loud, because the silent version is worse than the failure.
             * A spoken interview that quietly turns into a text one reads as the product
             * having been built that way — the candidate has no way to tell a broken voice
             * from a missing feature, and assumes the second.
             */
            <p className="text-caption text-ink-muted" role="status">
              The interviewer&rsquo;s voice is unavailable right now, so this round is in
              writing. Everything else works the same — read the question and answer out loud.
            </p>
          ) : null}
        </div>

        {/*
          * What the candidate is saying, as they say it.
          *
          * Speaking into a machine that shows no sign of hearing you is the least
          * interview-like part of this, and the specific worry it removes is not knowing
          * whether your words are arriving intact. It is explicitly a mirror: the report is
          * built from the model's own transcription of the recording, not from this, and
          * saying so matters because the two will sometimes disagree.
          */}
        {phase === "answering" && liveTranscript.supported ? (
          <div className="flex flex-col gap-1.5 border-l-2 border-line pl-4">
            <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
              What we are hearing
            </p>
            <p className="text-body text-ink-muted" aria-live="off">
              {liveTranscript.text || (
                <span className="text-ink-subtle">Listening — start whenever you are ready.</span>
              )}
            </p>
          </div>
        ) : null}

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

          {/*
            * The one place the room has a hand-over control, and why: silence cannot mean
            * "I'm done" when the work itself is silent. Saying "over to you" is what a
            * candidate does at a whiteboard anyway.
            */}
          {hasWorkspace && phase === "answering" ? (
            <button
              type="button"
              onClick={() => void finishAnswer()}
              className="rounded-md border border-line px-3 py-1.5 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken"
            >
              Over to you
            </button>
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
            ? hasWorkspace
              ? "Think out loud as you work — going quiet to type or draw won't end your turn. " +
                "Press “Over to you” when you want the interviewer to come in."
              : "Just start talking. Stop, and the interviewer moves on — pausing to think is fine."
            : "Asking for a nudge is allowed once per question, and the report records that you did."}
        </p>

        {capture.error ? (
          <p role="alert" className="text-caption text-danger">
            {capture.error}
          </p>
        ) : null}
      </main>
      </div>

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

function TerminalSession({ session }: { session: SessionView }) {
  const content =
    session.status === "abandoned"
      ? {
          eyebrow: "Interview ended",
          title: "This round was forfeited.",
          detail: "Its answers are not assessed, so there is no report for this round.",
        }
      : session.status === "failed"
        ? {
            eyebrow: "Interview stopped",
            title: "This round could not continue.",
            detail: "Nothing more can be submitted to this session. Start a new round when you are ready.",
          }
        : session.status === "created"
          ? {
              eyebrow: "Interview not ready",
              title: "This round is still being prepared.",
              detail: "Return to your dashboard and open it again once the first question is ready.",
            }
          : {
              eyebrow: "Interview unavailable",
              title: "This round cannot be opened.",
              detail: "Return to your dashboard to review its current state.",
            };

  return (
    <Centered>
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {content.eyebrow}
        </p>
        <h1 className="text-title text-ink">{content.title}</h1>
        <p className="text-body text-ink-muted">{content.detail}</p>
        <a
          href="/dashboard"
          className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
        >
          Back to dashboard
        </a>
      </div>
    </Centered>
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
