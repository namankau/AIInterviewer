"use client";

import type { RoundDraft, RoundType } from "@acemyinterview/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiRequestError, composeRound, startSession } from "@/lib/api";
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
export function NewInterviewForm() {
  const router = useRouter();
  const accessToken = useAccessToken();

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<RoundDraft | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return (
      <RoundSetup
        draft={draft}
        query={query}
        error={error}
        onEdit={() => {
          setDraft(null);
          setError(null);
        }}
        onStart={(id) => router.push(`/interview/${id}`)}
        accessToken={accessToken}
      />
    );
  }

  return (
    <form onSubmit={read} className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">New interview</p>
        <h1 className="text-title text-balance text-ink">What are you walking into?</h1>
        <p className="max-w-prose text-body text-ink-muted">
          Say it in one line — the employer, the round, whatever you are worried about. The round
          gets set up from that, and you get to correct it before anything starts.
        </p>
      </header>

      <div className="flex flex-col gap-3">
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
          className="w-full resize-none rounded-lg border border-line bg-surface-raised px-4 py-3.5 text-body text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
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
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Or start from one of these
        </p>
        <ul className="flex flex-col gap-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setQuery(example)}
                className="text-left text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
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
  onStart,
  accessToken,
}: {
  draft: RoundDraft;
  query: string;
  error: string | null;
  onEdit: () => void;
  onStart: (sessionId: string) => void;
  accessToken: string | null | undefined;
}) {
  const [companyName, setCompanyName] = useState(draft.companyName);
  const [roleTitle, setRoleTitle] = useState(draft.roleTitle);
  const [roundType, setRoundType] = useState<RoundType>(draft.roundType);
  const [durationMinutes, setDurationMinutes] = useState(draft.durationMinutes);
  const [language, setLanguage] = useState(draft.language);
  const [consentAudio, setConsentAudio] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    companyName.trim() !== "" && roleTitle.trim() !== "" && consentAudio && !!accessToken;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || pending) return;

    setPending(true);
    setError(null);
    try {
      const session = await startSession(accessToken, {
        companyName: companyName.trim(),
        roleTitle: roleTitle.trim(),
        roundType,
        language,
        consentAudio,
        // Whether to open the camera, not whether to keep what it sees. Nothing from it
        // is uploaded (`RECORD_CAMERA` in use-interview-capture.ts) or analysed
        // (`RoundMediaProperties` on the server) — it is on so the candidate practises
        // being looked at, which is a benefit that never leaves their own screen.
        consentVideo: cameraOn,
        durationMinutes,
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
    <form onSubmit={submit} className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">New interview</p>
        <h1 className="text-title text-balance text-ink">
          {draft.understood || "Set up your round"}
        </h1>
        {query ? (
          <p className="text-caption text-ink-subtle">
            From: &ldquo;{query}&rdquo;{" "}
            <button
              type="button"
              onClick={onEdit}
              className="text-accent underline-offset-4 hover:underline"
            >
              edit
            </button>
          </p>
        ) : null}
      </header>

      {composeError ? (
        <p role="alert" className="text-body text-danger">
          {composeError}
        </p>
      ) : null}

      {draft.assumptions.length > 0 ? (
        <section aria-labelledby="assumed" className="rounded-lg border border-line bg-surface-sunken p-5">
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
            className={INPUT}
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
            className={INPUT}
          />
        </Field>
      </div>

      {companyName.trim() !== "" ? (
        <p className="text-caption text-ink-muted">{draft.groundingNote}</p>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="pb-1 text-heading text-ink">Which round?</legend>
        <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          {ROUND_CATALOGUE.map((round) => {
            const selected = roundType === round.value;
            return (
              <label
                key={round.value}
                className={`flex cursor-pointer flex-col gap-1 bg-surface-raised p-4 transition-colors ${
                  selected ? "bg-surface-sunken" : "hover:bg-surface-sunken"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="roundType"
                    value={round.value}
                    checked={selected}
                    onChange={() => setRoundType(round.value)}
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

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Length" hint="Real rounds are time-boxed. The clock ends this one.">
          <select
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className={INPUT}
          >
            <option value={20}>20 minutes — a short round</option>
            <option value={30}>30 minutes</option>
            <option value={40}>40 minutes — a typical round</option>
            <option value={60}>60 minutes — a full panel</option>
          </select>
        </Field>
        <Field label="Language" hint="The register the interviewer uses.">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className={INPUT}
          >
            <option value="english">English</option>
            <option value="hindi_english">Hindi-English, code-switched</option>
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5">
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
        <p role="alert" className="text-body text-danger">
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
function blankDraft(): RoundDraft {
  return {
    companyName: "",
    roleTitle: "",
    level: "",
    roundType: "project_deep_dive",
    roundLabel: "Project deep-dive",
    durationMinutes: 40,
    language: "english",
    understood: "Who are you interviewing with?",
    assumptions: [],
    confidence: "low",
    archetypeLabel: "",
    archetypeConfidence: "inferred",
    groundingNote: "",
  };
}

const INPUT =
  "w-full rounded-md border border-line bg-surface-raised px-3.5 py-2.5 text-body text-ink " +
  "placeholder:text-ink-subtle focus:border-accent focus:outline-none";

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
    <label className="flex cursor-pointer items-start gap-3">
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
