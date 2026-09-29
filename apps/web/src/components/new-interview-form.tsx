"use client";

import type { CandidateStage, RoundDraft, RoundType } from "@acemyinterview/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CONTROL_CLASS } from "@/components/ui/field";
import { LoopBriefStep } from "@/components/loop-brief-step";
import { ApiRequestError, composeRound, startSession } from "@/lib/api";
import { loadVoices, pickVoice } from "@/lib/browser-speech";
import { ROUND_CATALOGUE } from "@/lib/rounds";
import { useAccessToken } from "@/lib/use-access-token";


/**
 * Real sentences, not placeholder poetry. Each one is a round this actually runs, and
 * naming Infosys and a techno-managerial panel beside Google says more about coverage
 * than a paragraph of copy would.
 */
const EXAMPLES = [
  "Infosys MR round next Tuesday — 5 years, Java backend, and I always fumble the escalation questions.",
  "Google L4 system design in six weeks. I haven't interviewed in four years.",
  "Deloitte consultant case round. First time doing a case, I have no idea how to structure one.",
  "HR round at Adyen — Amsterdam, and I need to talk about relocation and notice period.",
];

/**
 * Setting up a round.
 *
 * The composer comes first because a candidate knows what they are walking into as a
 * sentence, not as four fields: "Infosys MR round next Tuesday" is how they think about
 * it, and making them decompose that into company, role, round type and duration is work
 * we can do for them.
 *
 * The draft is always shown back before anything starts. A setup that quietly guessed
 * wrong would waste the round — the wrong employer means the wrong rubric, and they find
 * out half an hour in — so the model proposes and the candidate confirms, with everything
 * it assumed listed where they can see it.
 *
 * Company and role are still named per session and nothing is stored as a target
 * (PRD 05). The composer changes how they are typed, not what is kept.
 */
export function NewInterviewForm({ initialTopic = "" }: { initialTopic?: string }) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const topic = initialTopic.trim();

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<RoundDraft | null>(() =>
    topic === "" ? null : blankDraft(topic),
  );
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Past the "how they interview" step, either because the candidate chose a round from
  // it or asked to skip straight to setup.
  const [pastBrief, setPastBrief] = useState(false);
  const [chosenRoundType, setChosenRoundType] = useState<RoundType | null>(null);

  async function read(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || reading || query.trim() === "") return;

    setReading(true);
    setError(null);
    try {
      setDraft(await composeRound(accessToken, query.trim()));
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "We could not read that just now. Fill the round in yourself and it starts the same way.",
      );
      setDraft(blankDraft());
    } finally {
      setReading(false);
    }
  }

  if (draft) {
    const hasCompany = draft.companyName.trim() !== "";

    const onEdit = () => {
      setDraft(null);
      setError(null);
      setPastBrief(false);
      setChosenRoundType(null);
    };

    if (hasCompany && draft.roundType !== "custom_topic" && !pastBrief) {
      return (
        <LoopBriefStep
          companyName={draft.companyName}
          roleTitle={draft.roleTitle}
          accessToken={accessToken}
          onChooseRound={(roundType) => {
            setChosenRoundType(roundType);
            setPastBrief(true);
          }}
          onSkip={() => setPastBrief(true)}
          onEdit={onEdit}
        />
      );
    }

    return (
      <RoundSetup
        draft={chosenRoundType ? { ...draft, roundType: chosenRoundType } : draft}
        query={query}
        error={error}
        onEdit={onEdit}
        // The brief was shown first whenever a company was recognised — that's the only
        // path into this screen with `hasCompany` true, so it's also the only case
        // "back to the brief" makes sense.
        onBackToBrief={
          hasCompany && draft.roundType !== "custom_topic"
            ? () => {
                setChosenRoundType(null);
                setPastBrief(false);
              }
            : null
        }
        onStart={(id) => router.push(`/interview/${id}`)}
        accessToken={accessToken}
      />
    );
  }

  return (
    <form onSubmit={read} className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-[1.5rem] bg-navy p-7 text-on-navy shadow-[var(--shadow-md)] sm:p-9">
        <div aria-hidden="true" className="absolute -top-20 -right-14 size-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex flex-col gap-3">
        <p className="pill pill-navy w-fit">New interview</p>
        <h1 className="text-display text-balance text-on-navy">What are you walking into?</h1>
        <p className="max-w-prose text-body text-on-navy-muted">
          Say it in one line — the employer, the round, whatever you are worried about. The round
          gets set up from that, and you get to correct it before anything starts.
        </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <label htmlFor="composer" className="sr-only">
          Describe the interview you are preparing for
        </label>
        <textarea
          id="composer"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          maxLength={600}
          required
          placeholder="Infosys MR round next Tuesday. 5 years, Java backend."
          className="w-full resize-none rounded-xl border border-line bg-surface px-5 py-4 text-body text-ink shadow-[var(--shadow-sm)] placeholder:text-ink-subtle transition-colors focus:border-accent focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={reading || query.trim() === "" || !accessToken} aria-busy={reading}>
            {reading ? "Reading that…" : "Set up the round"}
          </Button>
          <button
            type="button"
            onClick={() => setDraft(blankDraft())}
            className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Or fill it in yourself
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-sunken p-5 sm:p-6">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Or start from one of these
        </p>
        <ul className="grid gap-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setQuery(example)}
                className="w-full rounded-xl border border-line bg-surface-raised px-4 py-3 text-left text-caption text-ink-muted transition-colors hover:border-accent/40 hover:bg-accent-wash hover:text-ink"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </form>
  );
}

/**
 * The draft, shown back for correction. Every field is editable — the model proposes and
 * the candidate decides, because they are the one who knows what they are walking into.
 */
function RoundSetup({
  draft,
  query,
  error: composeError,
  onEdit,
  onBackToBrief,
  onStart,
  accessToken,
}: {
  draft: RoundDraft;
  query: string;
  error: string | null;
  onEdit: () => void;
  /** Null when this session never went through the loop brief, so there's nowhere to go back to. */
  onBackToBrief: (() => void) | null;
  onStart: (sessionId: string) => void;
  accessToken: string | null | undefined;
}) {
  const [companyName, setCompanyName] = useState(draft.companyName);
  const [roleTitle, setRoleTitle] = useState(draft.roleTitle);
  const [roundType, setRoundType] = useState<RoundType>(draft.roundType);
  const [focusTopic, setFocusTopic] = useState(draft.focusTopic ?? "");
  const [durationMinutes, setDurationMinutes] = useState(draft.durationMinutes);
  const [language, setLanguage] = useState(draft.language);
  const [consentAudio, setConsentAudio] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  // Optional, and left blank by default: leaving it blank must behave exactly as it did
  // before this field existed, deriving the stage from the role title and resume alone.
  const [candidateStage, setCandidateStage] = useState<CandidateStage | "">("");
  /*
   * Whether this browser can read the questions out itself. Decided here because the
   * session is created here, and the opening question is synthesised as part of creating
   * it — by the time the room exists it is already too late to save the call.
   */
  const [speaksLocally, setSpeaksLocally] = useState(false);

  useEffect(() => {
    let active = true;
    void loadVoices().then((voices) => {
      if (active) setSpeaksLocally(pickVoice(voices, language) !== null);
    });
    return () => {
      active = false;
    };
  }, [language]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    companyName.trim() !== "" &&
    roleTitle.trim() !== "" &&
    (roundType !== "custom_topic" || focusTopic.trim() !== "") &&
    consentAudio &&
    !!accessToken;

  function selectRound(value: RoundType) {
    setRoundType(value);
    if (value === "custom_topic" && ![10, 20, 30].includes(durationMinutes)) {
      setDurationMinutes(20);
    } else if (value !== "custom_topic" && durationMinutes === 10) {
      setDurationMinutes(40);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || pending) return;

    setPending(true);
    setError(null);
    try {
      const session = await startSession(accessToken, {
        speaksLocally,
        companyName: companyName.trim(),
        roleTitle: roleTitle.trim(),
        roundType,
        language,
        consentAudio,
        // Whether to open the camera, not whether to keep what it sees. Nothing from it
        // is recorded, uploaded or analysed — it is on so the candidate practises
        // being looked at, which is a benefit that never leaves their own screen.
        consentVideo: cameraOn,
        durationMinutes,
        candidateStage: candidateStage === "" ? undefined : candidateStage,
        focusTopic: roundType === "custom_topic" ? focusTopic.trim() : undefined,
      });
      onStart(session.id);
    } catch (cause) {
      setPending(false);
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "The interview could not be started. Please try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <header className="relative overflow-hidden rounded-[1.5rem] bg-navy p-7 text-on-navy shadow-[var(--shadow-md)] sm:p-9">
        <div aria-hidden="true" className="absolute -top-20 -right-14 size-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex flex-col gap-3">
        <p className="pill pill-navy w-fit">Confirm your round</p>
        {onBackToBrief ? (
          <button
            type="button"
            onClick={onBackToBrief}
            className="self-start text-caption text-on-navy-muted underline-offset-4 hover:text-on-navy hover:underline"
          >
            ← Back to how {draft.companyName} interviews
          </button>
        ) : null}
        <h1 className="text-title text-balance text-on-navy">
          {draft.understood || "Set up your round"}
        </h1>
        {query ? (
          <p className="text-caption text-on-navy-muted">
            From: &ldquo;{query}&rdquo;{" "}
            <button
              type="button"
              onClick={onEdit}
              className="text-on-navy underline-offset-4 hover:underline"
            >
              edit
            </button>
          </p>
        ) : null}
        </div>
      </header>

      {composeError ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {composeError}
        </p>
      ) : null}

      {draft.assumptions.length > 0 ? (
        <section aria-labelledby="assumed" className="rounded-2xl border border-highlight/35 bg-highlight/10 p-5 sm:p-6">
          <h2 id="assumed" className="pb-2 font-mono text-micro tracking-widest text-ink-subtle uppercase">
            What we filled in for you
          </h2>
          <ul className="flex flex-col gap-1">
            {draft.assumptions.map((assumption) => (
              <li key={assumption} className="text-caption text-ink-muted">
                {assumption}
              </li>
            ))}
          </ul>
          <p className="pt-3 text-caption text-ink-subtle">
            Change anything below that is wrong. The wrong employer means the wrong rubric, and
            you would find out half an hour in.
          </p>
        </section>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Company" hint="The employer you're interviewing with.">
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Infosys"
            autoComplete="organization"
            required
            maxLength={120}
            className={CONTROL_CLASS}
          />
        </Field>
        <Field label="Role" hint="As it appears on the job posting.">
          <input
            value={roleTitle}
            onChange={(event) => setRoleTitle(event.target.value)}
            placeholder="Senior Backend Engineer"
            autoComplete="organization-title"
            required
            maxLength={120}
            className={CONTROL_CLASS}
          />
        </Field>
      </div>

      {companyName.trim() !== "" ? (
        <p className="text-caption text-ink-muted">{draft.groundingNote}</p>
      ) : null}

      <Field
        label="Where are you in your career?"
        hint="Optional — so the questions match where you are. Leave it blank and we'll go by the role and resume."
      >
        <select
          value={candidateStage}
          onChange={(event) => setCandidateStage(event.target.value as CandidateStage | "")}
          className={CONTROL_CLASS}
        >
          <option value="">Prefer not to say</option>
          <option value="student">Student, still studying</option>
          <option value="recent_graduate">Recent graduate, no job yet</option>
          <option value="professional">Working professional</option>
        </select>
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <legend className="pb-1 text-heading text-ink">Which round?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROUND_CATALOGUE.map((round) => {
            const selected = roundType === round.value;
            return (
              <label
                key={round.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                  selected
                    ? "border-accent/40 bg-accent-wash shadow-[var(--shadow-sm)]"
                    : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="roundType"
                    value={round.value}
                    checked={selected}
                    onChange={() => selectRound(round.value)}
                    className="size-4 accent-accent"
                  />
                  <span className="text-body font-medium text-ink">{round.label}</span>
                </span>
                <span className="pl-[1.625rem] text-caption text-ink-muted">{round.blurb}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {roundType === "custom_topic" ? (
        <Field
          label="Topic to practise"
          hint="The interviewer stays within this scope. Try Java collections, operating systems, SQL joins, or SOLID principles."
        >
          <input
            value={focusTopic}
            onChange={(event) => setFocusTopic(event.target.value)}
            placeholder="Java collections"
            required
            maxLength={160}
            autoFocus
            className={CONTROL_CLASS}
          />
        </Field>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Length" hint="Real rounds are time-boxed. The clock ends this one.">
          <select
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className={CONTROL_CLASS}
          >
            {roundType === "custom_topic" ? (
              <>
                <option value={10}>10 minutes — a quick topic check</option>
                <option value={20}>20 minutes — focused practice</option>
                <option value={30}>30 minutes — a thorough topic round</option>
              </>
            ) : (
              <>
                <option value={5}>5 minutes — just testing the room</option>
                <option value={20}>20 minutes — a short round</option>
                <option value={30}>30 minutes</option>
                <option value={40}>40 minutes — a typical round</option>
                <option value={60}>60 minutes — a full panel</option>
              </>
            )}
          </select>
        </Field>
        <Field label="Language" hint="The register the interviewer uses.">
          <select
            value={language}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "english" || value === "hindi_english") setLanguage(value);
            }}
            className={CONTROL_CLASS}
          >
            <option value="english">English</option>
            <option value="hindi_english">Hindi-English, code-switched</option>
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-accent/25 bg-accent-wash p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <legend className="px-2 text-heading text-ink">Before we start</legend>
        <p className="text-caption text-ink-muted">
          This interview is spoken. Nothing is recorded until you agree, and everything
          recorded is private to your account — you can delete it at any time.
        </p>
        <Consent
          checked={consentAudio}
          onChange={setConsentAudio}
          title="Record my voice"
          detail="Required. Your answers are assessed from what you say."
        />
        <Consent
          checked={cameraOn}
          onChange={setCameraOn}
          title="Turn my camera on"
          detail="Optional. You and the interviewer face each other, the way a real interview runs. Your camera stays on your screen — nothing from it is uploaded, recorded or scored."
        />
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!ready || pending} aria-busy={pending}>
          {pending ? "Setting up…" : "Begin interview"}
        </Button>
        {!consentAudio ? (
          <p className="text-caption text-ink-subtle">Voice recording is required to continue.</p>
        ) : null}
      </div>
    </form>
  );
}

/** The manual path: the same setup with nothing filled in and nothing assumed. */
function blankDraft(focusTopic = ""): RoundDraft {
  const customTopic = focusTopic.trim();
  return {
    companyName: "",
    roleTitle: "",
    level: "",
    roundType: customTopic === "" ? "project_deep_dive" : "custom_topic",
    roundLabel: customTopic === "" ? "Project deep-dive" : "Custom topic",
    durationMinutes: customTopic === "" ? 40 : 20,
    language: "english",
    understood:
      customTopic === "" ? "Who are you interviewing with?" : `Practise ${customTopic} in a focused interview.`,
    assumptions: [],
    confidence: "low",
    archetypeLabel: "",
    archetypeConfidence: "inferred",
    groundingNote: "",
    focusTopic: customTopic === "" ? null : customTopic,
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">{label}</span>
      {children}
      <span className="text-caption text-ink-subtle">{hint}</span>
    </label>
  );
}

function Consent({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-raised p-4 transition-colors hover:border-accent/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-accent"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-body text-ink">{title}</span>
        <span className="text-caption text-ink-muted">{detail}</span>
      </span>
    </label>
  );
}
