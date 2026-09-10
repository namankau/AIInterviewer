"use client";

/**
 * The person on the other side of the table.
 *
 * The room used to be a page of text. That is a strange thing to sit in front of with a
 * camera on: the candidate is exposed and nothing is exposed back, which is worse than
 * either being on camera with a person or being on neither. This is what the camera
 * reciprocates.
 *
 * **Drawn, not photographed, and deliberately so.** A synthetic photoreal face gets
 * mistaken for a real person, and the moment a candidate believes there is a human here
 * the product has lied to them. An illustration is honest about what it is and still
 * occupies the chair. It also sidesteps the uncanny valley, which is unpleasant at the
 * best of times and much worse when someone is already nervous.
 *
 * It has no name and never introduces itself as one — the same rule the opening prompt
 * follows. It is "your interviewer", the way an unfamiliar face across a table is until
 * they say otherwise.
 *
 * **Nothing here is lip-synced.** The obvious next step would be to run the question
 * audio through a Web Audio analyser and drive the mouth from the real amplitude, and it
 * is deliberately not done: `createMediaElementSource` re-routes the element's output
 * through the audio graph, so getting it wrong makes the interviewer silent, and the
 * signed audio URL is cross-origin, so the analyser would very likely read zeroes and
 * leave the face slack while it talks. A confident, unsynced speaking motion reads better
 * than a broken synced one, and it cannot break the interview.
 *
 * The one thing that *is* driven by real data is listening, which uses the microphone
 * meter the room already has — so the figure genuinely leans into a loud answer.
 */

export type PresenceState =
  /** Reading the question out. */
  | "speaking"
  /** The candidate has the floor. */
  | "listening"
  /** Between the answer ending and the next question existing. */
  | "thinking"
  /** Before the round starts, or after it ends. */
  | "waiting";

interface InterviewerPresenceProps {
  state: PresenceState;
  /** Microphone level, 0 to 1. Only meaningful while listening. */
  level?: number;
}

export function InterviewerPresence({ state, level = 0 }: InterviewerPresenceProps) {
  const attentive = state === "listening";

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        {/*
         * The ring is the only thing that carries the accent, and only while the
         * interviewer is actually doing something. A permanently glowing avatar is
         * decoration; one that lights up when it speaks is information.
         */}
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full border transition-[opacity,transform] duration-500 ${
            state === "speaking"
              ? "border-accent opacity-100"
              : attentive
                ? "border-accent/50 opacity-100"
                : "border-transparent opacity-0"
          }`}
          style={attentive ? { transform: `scale(${1 + Math.min(level, 1) * 0.06})` } : undefined}
        />
        <Portrait state={state} />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Your interviewer
        </span>
        {/*
         * The one accessible announcement of what the interviewer is doing. The portrait
         * itself is decorative: a screen reader that described both would say it twice.
         */}
        <span role="status" className="text-caption text-ink-muted">
          {DESCRIPTION[state]}
        </span>
      </div>
    </div>
  );
}

/** What the figure is doing, in words, for anyone who would rather read than watch. */
const DESCRIPTION: Record<PresenceState, string> = {
  speaking: "Asking you a question",
  listening: "Listening",
  thinking: "Considering your answer",
  waiting: "Ready when you are",
};

/**
 * An editorial line portrait: a drawn face, contour lines and one weight of ink, in the
 * register of a well-set technical book rather than a product illustration.
 *
 * The first attempt filled the head with solid ink and knocked the features out of it in
 * the page colour. Rendered, that is a balaclava — a dark mass with light slits for eyes
 * and a light hole for a mouth. Genuinely sinister, and pointed at someone who is already
 * nervous about their livelihood. Drawing it as line-work on a light face is not a style
 * preference; it is the difference between a person and a threat.
 */
function Portrait({ state }: { state: PresenceState }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`size-[72px] ${state === "speaking" ? "presence-speaking" : ""} ${
        state === "thinking" ? "presence-thinking" : ""
      }`}
      aria-hidden
    >
      <defs>
        <clipPath id="presence-frame">
          <circle cx="60" cy="60" r="54" />
        </clipPath>
      </defs>

      <circle cx="60" cy="60" r="54" className="fill-surface-sunken" />

      <g
        clipPath="url(#presence-frame)"
        className="presence-figure stroke-ink"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/*
         * Neck first, and as a fill with the two side lines drawn separately. Stroking it
         * as a closed shape puts a line across the chest that the shoulders — a wash, not
         * a solid — do not hide.
         */}
        <path d="M51 58h18v32H51z" className="fill-surface-raised stroke-none" />
        <path d="M51 68v20M69 68v20" className="fill-none" />

        {/* Shoulders. A wash rather than a fill, so the ink stays in the line. */}
        <path
          d="M15 122c0-20 13-30 28-33l17-4 17 4c15 3 28 13 28 33z"
          className="fill-ink/10 stroke-ink"
        />
        {/* The collar, which is most of what makes a shape read as somebody dressed for this. */}
        <path d="M51 86l9 12 9-12" className="fill-none" />

        {/* Head. */}
        <ellipse cx="60" cy="49" rx="22" ry="25" className="fill-surface-raised" />
        {/* An ear, because a head without one reads as a mannequin. */}
        <path d="M38 47c-4 0-5 4-4 7s3 5 5 5" className="fill-surface-raised" />

        {/* Hair, as one confident shape rather than strands. */}
        <path
          d="M38 46c-1-17 9-27 22-27s23 10 22 27c-3-10-8-14-15-15-8-1-12 2-18 3-5 1-9 4-11 12z"
          className="fill-ink stroke-ink"
        />

        {/* Brows, then eyes. Small marks: a portrait, not a character. */}
        <g className="presence-eyes">
          <path d="M49 44.5c2-1.6 5-1.6 7 0M64 44.5c2-1.6 5-1.6 7 0" className="fill-none" />
          <circle cx="52.5" cy="51" r="2.1" className="fill-ink stroke-none" />
          <circle cx="67.5" cy="51" r="2.1" className="fill-ink stroke-none" />
        </g>

        {/* Nose. */}
        <path d="M60 53v7h3.5" className="fill-none" />

        {/* The mouth. A closed line at rest, and what moves when the interviewer talks. */}
        <rect
          x="54"
          y="65"
          width="12"
          height="2.6"
          rx="1.3"
          className="presence-mouth fill-ink stroke-none"
        />
      </g>

      <circle cx="60" cy="60" r="54" className="fill-none stroke-line-strong" strokeWidth="1" />
    </svg>
  );
}
