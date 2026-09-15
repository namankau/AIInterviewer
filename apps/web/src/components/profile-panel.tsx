"use client";

import type { ProfileDetails, ResumeView } from "@acemyinterview/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ApiRequestError,
  deleteSkill,
  fetchProfile,
  updateProfile,
  uploadAvatar,
  uploadResume,
  upsertSkill,
} from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * The candidate's profile.
 *
 * The resume is the point of this page. Without one, a project deep-dive has a company
 * and a job title to work from and has to invent something to ask about; with one, the
 * interviewer can ask about the settlement pipeline they actually built. Everything else
 * here is secondary and says so by being below it.
 *
 * The parse is shown back in full, and **what we were unsure of is shown first**. A
 * mis-read employer degrades every future round, and the candidate is the only person who
 * can catch it.
 */
export function ProfilePanel() {
  const accessToken = useAccessToken();
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "resume" | "avatar" | "profile" | "skill">(null);
  /**
   * What just happened, so a save is visibly a save.
   *
   * Pressing Save and getting nothing back is indistinguishable from pressing Save and
   * having it fail silently, and a candidate who cannot tell will fill the form in twice.
   */
  const [saved, setSaved] = useState<string | null>(null);

  const resumeInput = useRef<HTMLInputElement | null>(null);
  const avatarInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchProfile({ accessToken })
      .then((it) => active && setDetails(it))
      .catch(() => undefined)
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [accessToken]);

  const run = useCallback(
    async (kind: NonNullable<typeof busy>, work: () => Promise<void>) => {
      if (!accessToken) return;
      setBusy(kind);
      setError(null);
      setSaved(null);
      try {
        await work();
        setSaved(DONE[kind]);
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError ? cause.message : "That did not work. Please try again.",
        );
      } finally {
        setBusy(null);
      }
    },
    [accessToken],
  );

  // The confirmation clears itself. A "Saved" that stays on screen stops meaning
  // "just now" and starts meaning nothing.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 4_000);
    return () => clearTimeout(timer);
  }, [saved]);

  const onResume = (file: File) =>
    run("resume", async () => {
      const resume = await uploadResume(accessToken!, file);
      setDetails((current) =>
        current
          ? { ...current, resume }
          : { resume, skills: [], avatarUrl: null, currentLevel: null, targetLevel: null, linkedinUrl: null },
      );
      // Detected skills land server-side, so the list is re-read rather than guessed at.
      setDetails(await fetchProfile({ accessToken: accessToken! }));
    });

  if (!loaded) {
    return (
      <p role="status" className="text-body text-ink-muted">
        Loading your profile…
      </p>
    );
  }

  const resume = details?.resume ?? null;

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="resume" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 id="resume" className="text-title text-ink">
            Your resume
          </h2>
          <p className="max-w-prose text-body text-ink-muted">
            This is what makes an interview about your work rather than about your job title.
            Upload it once and every round can dig into what you actually built.
          </p>
        </div>

        <input
          ref={resumeInput}
          type="file"
          accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onResume(file);
            event.target.value = "";
          }}
        />

        {resume ? <ResumeSummary resume={resume} /> : null}

        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="button"
            onClick={() => resumeInput.current?.click()}
            disabled={busy !== null}
            aria-busy={busy === "resume"}
          >
            {busy === "resume" ? "Reading it…" : resume ? "Replace resume" : "Upload resume"}
          </Button>
          <span className="text-caption text-ink-subtle">
            PDF, Word or plain text. We read it once — this takes a few seconds.
          </span>
        </div>
      </section>

      <ProfileForm
        details={details}
        disabled={busy !== null}
        onSave={(body) =>
          run("profile", async () => {
            setDetails(await updateProfile(accessToken!, body));
          })
        }
      />

      <section aria-labelledby="skills" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 id="skills" className="text-heading text-ink">
            Skills
          </h2>
          <p className="text-caption text-ink-subtle">
            Pulled from your resume. Mark the ones you would rather not be asked about — the
            interviewer will know they are a stretch, not that they are off limits.
          </p>
        </div>

        <SkillList
          skills={details?.skills ?? []}
          disabled={busy !== null}
          onToggleWeak={(skill) =>
            run("skill", async () => {
              const skills = await upsertSkill(accessToken!, {
                name: skill.name,
                selfRatedConfidence: skill.selfRatedConfidence ?? undefined,
                flaggedAsWeak: !skill.flaggedAsWeak,
              });
              setDetails((current) => (current ? { ...current, skills } : current));
            })
          }
          onRemove={(name) =>
            run("skill", async () => {
              await deleteSkill(accessToken!, name);
              setDetails(await fetchProfile({ accessToken: accessToken! }));
            })
          }
        />
      </section>

      <section aria-labelledby="photo" className="flex flex-col gap-4">
        <h2 id="photo" className="text-heading text-ink">
          Photo
        </h2>
        <div className="flex items-center gap-5">
          {details?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed, expiring URL
            <img
              src={details.avatarUrl}
              alt=""
              className="size-16 rounded-full border border-line object-cover"
            />
          ) : (
            <span aria-hidden className="size-16 rounded-full border border-line bg-surface-sunken" />
          )}
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void run("avatar", async () => setDetails(await uploadAvatar(accessToken!, file)));
              }
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            disabled={busy !== null}
            className="text-caption text-accent underline-offset-4 hover:underline disabled:opacity-50"
          >
            {details?.avatarUrl ? "Change photo" : "Add a photo"}
          </button>
        </div>
      </section>

      {/*
        * Both live at the bottom, both announced. `role="status"` rather than `alert`
        * for the success case: a screen reader should mention it, not interrupt for it.
        */}
      {error ? (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      ) : null}

      {saved && !error ? (
        <p role="status" className="text-body text-positive">
          {saved}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What we read, shown back so it can be corrected.
 *
 * Uncertainty goes at the top, deliberately. Burying "we were not sure about your second
 * employer" under a tidy summary is how a wrong parse survives into every future round.
 */
function ResumeSummary({ resume }: { resume: ResumeView }) {
  const years = resume.totalExperienceMonths ? Math.round(resume.totalExperienceMonths / 12) : null;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface-raised shadow-[var(--shadow-sm)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-body text-ink">{resume.filename}</span>
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {resume.status === "parsed" ? "read" : resume.status}
        </span>
      </div>

      {resume.status === "failed" ? (
        <p className="text-body text-danger">
          {resume.error ?? "We could not read that file."}
        </p>
      ) : null}

      {resume.lowConfidenceFields.length > 0 ? (
        <div className="flex flex-col gap-1 border-l-2 border-danger pl-4">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Check these
          </span>
          <p className="max-w-prose text-caption text-ink-muted">
            We were not confident reading {resume.lowConfidenceFields.join(", ")}. If any of it is
            wrong, fix it in the document and upload again — a wrong employer changes every round
            built on it.
          </p>
        </div>
      ) : null}

      {resume.headline ? <p className="text-body text-ink-muted">{resume.headline}</p> : null}

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat term="Experience" value={years === null ? "—" : `${years} years`} />
        <Stat term="Roles" value={String(resume.employments.length)} />
        <Stat term="Projects" value={String(resume.projects.length)} />
      </dl>

      {resume.projects.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            What an interviewer will dig into
          </span>
          <ul className="flex flex-col gap-1">
            {resume.projects.slice(0, 4).map((project) => (
              <li key={project.name} className="text-caption text-ink-muted">
                <span className="text-ink">{project.name}</span>
                {project.technologies.length > 0 ? ` · ${project.technologies.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-ink-subtle">{term}</dt>
      <dd className="font-mono text-body text-ink">{value}</dd>
    </div>
  );
}

function SkillList({
  skills,
  disabled,
  onToggleWeak,
  onRemove,
}: {
  skills: ProfileDetails["skills"];
  disabled: boolean;
  onToggleWeak: (skill: ProfileDetails["skills"][number]) => void;
  onRemove: (name: string) => void;
}) {
  if (skills.length === 0) {
    return (
      <p className="text-caption text-ink-subtle">
        Nothing yet. Upload a resume and these fill in from what it evidences.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <li
          key={skill.name}
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-caption ${
            skill.flaggedAsWeak
              ? "border-line-strong bg-surface-sunken text-ink-subtle"
              : "border-line text-ink"
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggleWeak(skill)}
            title={skill.flaggedAsWeak ? "Marked as a stretch" : "Mark as a stretch"}
            className="disabled:opacity-50"
          >
            {skill.name}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(skill.name)}
            aria-label={`Remove ${skill.name}`}
            className="text-ink-subtle hover:text-ink disabled:opacity-50"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProfileForm({
  details,
  disabled,
  onSave,
}: {
  details: ProfileDetails | null;
  disabled: boolean;
  onSave: (body: Record<string, string>) => void;
}) {
  /*
   * What the server has, and what the candidate has typed over the top of it, kept apart.
   *
   * The obvious version — copy the saved values into state and re-copy them in an effect
   * when they arrive — is wrong twice over. The profile is fetched after this mounts, so a
   * single copy at mount shows the blank form forever, which is the bug this had. And
   * re-copying inside an effect is a cascading render that React's own lint rejects.
   *
   * Holding only the edits and merging at render needs neither. Untouched fields follow
   * the server; a field the candidate has started typing in is theirs and a late response
   * cannot overwrite it underneath them.
   *
   * `currentLevel` falls back to the role the resume says they are in now. They told us
   * that by uploading the document; asking them to type it again is asking twice.
   */
  const saved = useMemo(
    () => ({
      currentLevel: details?.currentLevel ?? currentRoleFrom(details) ?? "",
      targetLevel: details?.targetLevel ?? "",
      linkedinUrl: details?.linkedinUrl ?? "",
    }),
    [details],
  );
  const [edits, setEdits] = useState<Partial<typeof saved>>({});
  const fields = { ...saved, ...edits };

  const set = (key: keyof typeof saved) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setEdits((current) => ({ ...current, [key]: value }));
  };

  return (
    <section aria-labelledby="details" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="details" className="text-heading text-ink">
          Role and level
        </h2>
        <p className="text-caption text-ink-subtle">
          What a round is pitched at. A staff candidate who cannot estimate load is a different
          problem from a junior who cannot, and the report says so.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Current level" hint="As your employer titles it.">
          <input value={fields.currentLevel} onChange={set("currentLevel")} className={INPUT} maxLength={60} />
        </Field>
        <Field label="Target level" hint="What you are interviewing for.">
          <input value={fields.targetLevel} onChange={set("targetLevel")} className={INPUT} maxLength={60} />
        </Field>
        <Field label="LinkedIn" hint="Optional. Stored, shown back to you, and not fetched.">
          <input
            value={fields.linkedinUrl}
            onChange={set("linkedinUrl")}
            placeholder="https://linkedin.com/in/…"
            className={INPUT}
            maxLength={300}
          />
        </Field>
      </div>

      <div>
        <Button
          type="button"
          disabled={disabled}
          /*
           * Blank fields are sent, not filtered out. The server reads absent as "leave it"
           * and blank as "clear it", so dropping them here made a field impossible to
           * empty once it had been filled in.
           */
          onClick={() => {
            // Handing the fields back to the server's copy: the response is the truth now.
            setEdits({});
            onSave(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()])));
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
}

/** The role the resume says they are in now, which is what "current level" is asking for. */
function currentRoleFrom(details: ProfileDetails | null): string | null {
  const employments = details?.resume?.employments ?? [];
  const current = employments.find((it) => it.current) ?? employments[0];
  return current?.title ?? null;
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

/** What to say once each kind of change has actually landed. */
const DONE: Record<"resume" | "avatar" | "profile" | "skill", string> = {
  resume: "Resume saved and read.",
  avatar: "Photo saved.",
  profile: "Saved.",
  skill: "Skills updated.",
};
