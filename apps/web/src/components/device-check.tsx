"use client";

import type { SessionView } from "@acemyinterview/shared";
import { useEffect, useRef } from "react";

import type { useInterviewCapture } from "@/lib/use-interview-capture";

type Capture = ReturnType<typeof useInterviewCapture>;

/**
 * The antechamber. Nobody should discover a dead microphone thirty seconds into a round
 * they set aside half an hour for.
 *
 * It does two jobs beyond the obvious one. It sets expectations — this is spoken, the
 * browser is about to ask, here is how long the round runs — so the permission prompt
 * arrives explained rather than as an ambush. And entering is a click, which is the
 * user gesture browsers require before audio may play with sound: without it the first
 * question is synthesised, stored, served, and then silently refused by the tab.
 */
export function DeviceCheck({
  session,
  capture,
  onEnter,
}: {
  session: SessionView;
  capture: Capture;
  onEnter: () => void;
}) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const requested = useRef(false);

  // Ask once, on arrival. Re-asking on every render would spam a candidate who declined.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void capture.requestDevices();
  }, [capture]);

  useEffect(() => {
    if (previewRef.current && capture.stream) {
      previewRef.current.srcObject = capture.stream;
    }
  }, [capture.stream]);

  const ready = capture.state === "ready" || capture.state === "recording";
  const blocked = capture.state === "denied" || capture.state === "unsupported";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {session.roundLabel} · {session.durationMinutes} minutes
        </p>
        <h1 className="text-title text-balance text-ink">
          {session.companyName} · {session.roleTitle}
        </h1>
        <p className="max-w-prose text-body text-ink-muted">{session.groundingNote}</p>
      </header>

      <section aria-labelledby="device-check" className="rounded-lg border border-line bg-surface-raised">
        <div className="border-b border-line px-5 py-3">
          <h2 id="device-check" className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Before you go in
          </h2>
        </div>

        <div className="flex flex-col divide-y divide-line">
          <DeviceRow
            label="Microphone"
            detail={microphoneDetail(capture.state)}
            state={ready ? "ready" : blocked ? "blocked" : "waiting"}
          >
            {ready ? <LevelMeter level={capture.level} /> : null}
          </DeviceRow>

          {session.consentVideo ? (
            <DeviceRow
              label="Camera"
              detail={
                capture.stream?.getVideoTracks().length
                  ? "On, and recording with the round."
                  : "Waiting for permission."
              }
              state={capture.stream?.getVideoTracks().length ? "ready" : blocked ? "blocked" : "waiting"}
            >
              {capture.stream?.getVideoTracks().length ? (
                <video
                  ref={previewRef}
                  muted
                  autoPlay
                  playsInline
                  aria-label="Your camera preview"
                  className="h-16 w-24 rounded border border-line bg-surface-sunken object-cover"
                />
              ) : null}
            </DeviceRow>
          ) : (
            <DeviceRow label="Camera" detail="Off — you did not consent to video for this round." state="off" />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading text-ink">How this round runs</h2>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          <RoundPromise term="It is spoken" detail="You answer out loud. There is nothing to type." />
          <RoundPromise
            term="It is on a clock"
            detail={`About ${session.durationMinutes} minutes. The round ends when the time does, not after a set number of questions.`}
          />
          <RoundPromise
            term="You can ask for help"
            detail="Stuck on a question, ask for a nudge. It is recorded, and the report says so."
          />
          <RoundPromise
            term="Your answer ends itself"
            detail="Stop talking and it moves on. Pausing to think is fine — a pause is not an ending."
          />
        </ul>
      </section>

      {capture.error ? (
        <p role="alert" className="text-body text-danger">
          {capture.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onEnter}
          disabled={blocked}
          className="rounded-md bg-accent px-6 py-3 text-body font-medium text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          Enter the room
        </button>
        <p className="text-caption text-ink-subtle">
          {blocked
            ? "The round is spoken, so it cannot start without a microphone."
            : ready
              ? "The interviewer speaks first."
              : "Your browser is asking for the microphone. Answer it and this turns ready."}
        </p>
      </div>
    </div>
  );
}

function microphoneDetail(state: Capture["state"]): string {
  switch (state) {
    case "ready":
    case "recording":
      return "Ready. Say something and the meter should move.";
    case "requesting":
      return "Waiting on the browser's permission prompt.";
    case "denied":
      return "Blocked. Allow the microphone for this site, then reload.";
    case "unsupported":
      return "This browser cannot record audio. Try Chrome, Edge or Safari.";
    default:
      return "Checking…";
  }
}

function DeviceRow({
  label,
  detail,
  state,
  children,
}: {
  label: string;
  detail: string;
  state: "ready" | "waiting" | "blocked" | "off";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-3">
        <StateDot state={state} />
        <span className="flex flex-col gap-0.5">
          <span className="text-body text-ink">{label}</span>
          <span className="text-caption text-ink-muted">{detail}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function StateDot({ state }: { state: "ready" | "waiting" | "blocked" | "off" }) {
  const tone =
    state === "ready"
      ? "bg-positive"
      : state === "blocked"
        ? "bg-danger"
        : state === "off"
          ? "bg-line-strong"
          : "bg-ink-subtle animate-pulse";
  return <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${tone}`} />;
}

/** Proof the microphone is live, which is the only thing that settles the question. */
function LevelMeter({ level }: { level: number }) {
  const bars = 8;
  const lit = Math.round(level * bars);
  return (
    <span aria-hidden className="flex items-end gap-0.5" role="presentation">
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={`w-1 rounded-sm transition-colors ${index < lit ? "bg-accent" : "bg-line"}`}
          style={{ height: `${6 + index * 2}px` }}
        />
      ))}
    </span>
  );
}

function RoundPromise({ term, detail }: { term: string; detail: string }) {
  return (
    <li className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-6">
      <span className="text-body text-ink sm:w-48 sm:shrink-0">{term}</span>
      <span className="text-caption text-ink-muted">{detail}</span>
    </li>
  );
}
