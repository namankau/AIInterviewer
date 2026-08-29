"use client";

import type { RoundType } from "@acemyinterview/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiRequestError, startSession } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

/** The rounds a candidate actually chooses between, in the order they meet them. */
const ROUNDS: Array<{ value: RoundType; label: string; blurb: string }> = [
  {
    value: "project_deep_dive",
    label: "Project deep-dive",
    blurb: "Your own work, interrogated. What you decided, what you traded off, what you'd change.",
  },
  {
    value: "technical_fundamentals",
    label: "Technical fundamentals",
    blurb: "Concept depth at your level. Precision matters more than vocabulary.",
  },
  {
    value: "system_design",
    label: "System design",
    blurb: "Requirements, components, failure modes, and the trade-offs you can defend.",
  },
  {
    value: "coding_practical",
    label: "Coding, spoken aloud",
    blurb: "Approach, edge cases and complexity — reasoned out loud rather than typed.",
  },
  {
    value: "behavioural_competency",
    label: "Behavioural",
    blurb: "Structured competency questions that want a specific situation, not a policy.",
  },
  {
    value: "techno_managerial",
    label: "Techno-managerial",
    blurb: "Delivery, estimation, escalation — how you behave when the plan slips.",
  },
  {
    value: "case_client_scenario",
    label: "Case and client scenario",
    blurb: "A client situation to structure aloud, escalating as you get comfortable.",
  },
  {
    value: "hr_fit_closing",
    label: "HR, fit and closing",
    blurb: "Notice, compensation, relocation, visa. The least-rehearsed part of most loops.",
  },
];

export function NewInterviewForm() {
  const router = useRouter();
  const accessToken = useAccessToken();

  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [roundType, setRoundType] = useState<RoundType>("project_deep_dive");
  const [language, setLanguage] = useState("english");
  const [consentAudio, setConsentAudio] = useState(false);
  const [consentVideo, setConsentVideo] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = companyName.trim() !== "" && roleTitle.trim() !== "" && consentAudio && !!accessToken;

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
        consentVideo,
      });
      router.push(`/interview/${session.id}`);
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
    <form onSubmit={submit} className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <p className="text-caption tracking-wide text-ink-subtle uppercase">New interview</p>
        <h1 className="text-title text-ink">Who are you interviewing with?</h1>
        <p className="max-w-prose text-body text-ink-muted">
          Nothing is saved as a target. You name the employer each time, and there is no limit on
          how many you practise for.
        </p>
      </header>

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

      <fieldset className="flex flex-col gap-4">
        <legend className="pb-1 text-heading text-ink">Which round?</legend>
        <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          {ROUNDS.map((round) => {
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

      <Field label="Language" hint="The register the interviewer uses.">
        <select value={language} onChange={(event) => setLanguage(event.target.value)} className={INPUT}>
          <option value="english">English</option>
          <option value="hindi_english">Hindi-English, code-switched</option>
        </select>
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5">
        <legend className="px-2 text-heading text-ink">Before we start</legend>
        <p className="text-caption text-ink-muted">
          This interview is spoken. Nothing is recorded until you agree, and everything recorded is
          private to your account — you can delete it at any time.
        </p>
        <Consent
          checked={consentAudio}
          onChange={setConsentAudio}
          title="Record my voice"
          detail="Required. Your answers are assessed from what you say."
        />
        <Consent
          checked={consentVideo}
          onChange={setConsentVideo}
          title="Record my camera"
          detail="Optional. Real interviews are on camera, and practising that way is most of the value."
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
