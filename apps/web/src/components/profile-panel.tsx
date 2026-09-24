"use client";

import type { ArenaProgressView, MeResponse, ProfileDetails, ResumeView, SessionSummary } from "@acemyinterview/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProgressBar } from "@/components/courses/course-progress";
import { Button } from "@/components/ui/button";
import { CONTROL_CLASS } from "@/components/ui/field";
import {
  ApiRequestError,
  deleteSkill,
  fetchArenaProgress,
  fetchMe,
  fetchProfile,
  fetchSessions,
  updateProfile,
  uploadAvatar,
  uploadResume,
  upsertSkill,
} from "@/lib/api";
import type { CourseOutline } from "@/lib/course-outline";
import { summarizeChapters } from "@/lib/course-progress";
import { useAccessToken } from "@/lib/use-access-token";
import { useAllCourseProgress } from "@/lib/use-course-progress";

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
export function ProfilePanel({ outlines = [] }: { outlines?: CourseOutline[] }) {
  const accessToken = useAccessToken();
  const courseProgress = useAllCourseProgress();
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [arena, setArena] = useState<ArenaProgressView | null>(null);
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
    Promise.allSettled([
      fetchProfile({ accessToken }),
      fetchMe({ accessToken }),
      fetchSessions({ accessToken }),
      fetchArenaProgress({ accessToken }),
    ]).then(([profile, candidate, history, arenaProgress]) => {
      if (!active) return;
      if (profile.status === "fulfilled") setDetails(profile.value);
      if (candidate.status === "fulfilled") setMe(candidate.value);
      if (history.status === "fulfilled") setSessions(history.value);
      if (arenaProgress.status === "fulfilled") setArena(arenaProgress.value);
      setLoaded(true);
    });
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
    <div className="flex flex-col gap-6">
      <ProfileOverview
        details={details}
        me={me}
        sessions={sessions}
        arena={arena}
        outlines={outlines}
        completed={courseProgress.completed}
        progressReady={courseProgress.status === "ready"}
        avatarInput={avatarInput}
        avatarBusy={busy === "avatar"}
        disabled={busy !== null}
        onAvatar={(file) =>
          run("avatar", async () => setDetails(await uploadAvatar(accessToken!, file)))
        }
      />

      <section
        aria-labelledby="resume"
        className="flex flex-col gap-5 rounded-2xl border border-accent/20 bg-accent-wash p-6 shadow-[var(--shadow-sm)] sm:p-8"
      >
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

      <section
        aria-labelledby="skills"
        className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8"
      >
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

      {/*
        * Both live at the bottom, both announced. `role="status"` rather than `alert`
        * for the success case: a screen reader should mention it, not interrupt for it.
        */}
      {error ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      {saved && !error ? (
        <p role="status" className="rounded-xl border border-positive/25 bg-positive/5 px-4 py-3 text-body text-positive">
          {saved}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The profile's front door: identity plus the useful evidence of practice already held
 * by the account. All numbers are derived from existing APIs; there is no second profile
 * model and no invented "readiness" score.
 */
function ProfileOverview({
  details,
  me,
  sessions,
  arena,
  outlines,
  completed,
  progressReady,
  avatarInput,
  avatarBusy,
  disabled,
  onAvatar,
}: {
  details: ProfileDetails | null;
  me: MeResponse | null;
  sessions: SessionSummary[];
  arena: ArenaProgressView | null;
  outlines: CourseOutline[];
  completed: Record<string, string[]>;
  progressReady: boolean;
  avatarInput: React.RefObject<HTMLInputElement | null>;
  avatarBusy: boolean;
  disabled: boolean;
  onAvatar: (file: File) => void;
}) {
  const courseSummaries = outlines.map((course) => ({
    course,
    summary: summarizeChapters(course.chapters, completed[course.slug] ?? []),
  }));
  const completedCourses = courseSummaries.filter(({ summary }) => summary.finished).length;
  const completedChapters = courseSummaries.reduce((total, { summary }) => total + summary.done, 0);
  const finishedRounds = sessions.filter((session) => session.status === "completed");
  const latestRound = [...finishedRounds].sort((a, b) =>
    (b.endedAt ?? b.startedAt ?? "").localeCompare(a.endedAt ?? a.startedAt ?? ""),
  )[0];
  const name = me?.displayName ?? me?.email ?? "Your profile";
  const initials = initialsOf(name);

  return (
    <section
      aria-labelledby="profile-overview"
      className="overflow-hidden rounded-[1.5rem] border border-line bg-surface-raised shadow-[var(--shadow-md)]"
    >
      <div className="grid gap-8 bg-[linear-gradient(135deg,var(--accent-wash),var(--surface-raised)_62%)] p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-5">
          <div className="relative shrink-0">
            {details?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed, expiring API URL
              <img
                src={details.avatarUrl}
                alt="Profile photo"
                className="size-24 rounded-2xl border-4 border-white object-cover shadow-[var(--shadow-md)]"
              />
            ) : (
              <span
                aria-label="Profile photo placeholder"
                className="grid size-24 place-items-center rounded-2xl bg-navy font-mono text-title font-bold text-on-navy shadow-[var(--shadow-md)]"
              >
                {initials}
              </span>
            )}
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={disabled}
              aria-label={details?.avatarUrl ? "Change profile photo" : "Add profile photo"}
              className="absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-full border-2 border-white bg-accent text-heading text-accent-contrast shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <span aria-hidden>{avatarBusy ? "…" : "+"}</span>
            </button>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAvatar(file);
                event.target.value = "";
              }}
            />
          </div>

          <div className="min-w-0">
            <p className="font-mono text-micro tracking-widest text-accent-strong uppercase">Candidate workspace</p>
            <h2 id="profile-overview" className="mt-1 truncate text-title text-ink">
              {name}
            </h2>
            <p className="mt-1 text-caption text-ink-muted">
              {details?.targetLevel ? `Working toward ${details.targetLevel}` : "Add a target role to shape future rounds."}
            </p>
          </div>
        </div>

        <Link
          href="/interview/new"
          className="w-fit rounded-xl bg-accent px-5 py-3 text-caption font-semibold text-accent-contrast shadow-[var(--shadow-sm)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-accent-strong"
        >
          Start a new round
        </Link>
      </div>

      <div className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        <OverviewStat label="Courses complete" value={progressReady ? `${completedCourses} / ${outlines.length}` : "—"} />
        <OverviewStat label="Chapters complete" value={progressReady ? String(completedChapters) : "—"} />
        <OverviewStat label="Rounds completed" value={String(finishedRounds.length)} />
        <OverviewStat label="Arena streak" value={arena ? `${arena.streak.current} day${arena.streak.current === 1 ? "" : "s"}` : "—"} />
      </div>

      <div className="grid gap-7 border-t border-line p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.8fr)]">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-heading text-ink">Course progress</h3>
            <Link href="/courses" className="text-caption font-medium text-accent hover:underline">
              View courses
            </Link>
          </div>
          <ul className="mt-4 grid gap-3">
            {courseSummaries.map(({ course, summary }) => (
              <li key={course.slug} className="rounded-xl border border-line bg-surface-sunken/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/courses/${course.slug}`} className="text-caption font-semibold text-ink hover:text-accent">
                    {course.title}
                  </Link>
                  {summary.next ? (
                    <Link
                      href={`/courses/${course.slug}/${summary.next.slug}`}
                      className="text-micro font-semibold text-accent hover:underline"
                    >
                      {summary.started ? "Continue" : "Start"}
                    </Link>
                  ) : (
                    <span className="text-micro font-semibold text-positive">Complete</span>
                  )}
                </div>
                <div className="mt-2">
                  <ProgressBar done={summary.done} total={summary.total} label={`${course.title} progress`} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-navy p-5 text-on-navy">
          <p className="font-mono text-micro tracking-widest text-on-navy-muted uppercase">Latest interview</p>
          {latestRound ? (
            <div className="mt-3 flex h-[calc(100%-1rem)] flex-col">
              <p className="text-heading text-on-navy">{latestRound.companyName}</p>
              <p className="mt-1 text-caption text-on-navy-muted">{latestRound.roleTitle}</p>
              <p className="mt-3 text-micro text-on-navy-muted">{roundLabel(latestRound.roundType)}</p>
              <Link
                href="/rounds"
                className="mt-auto pt-6 text-caption font-semibold text-on-navy underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Open interview history
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-body text-on-navy">No completed round yet.</p>
              <p className="mt-1 text-caption text-on-navy-muted">Your latest company, role and round type will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line px-6 py-5 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0">
      <p className="font-mono text-heading font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-micro text-ink-subtle">{label}</p>
    </div>
  );
}

function initialsOf(value: string): string {
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : parts[0]?.slice(0, 2) ?? "ME").toUpperCase();
}

function roundLabel(value: SessionSummary["roundType"]): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    <div className="flex flex-col gap-5 rounded-xl border border-accent/20 bg-surface-raised p-5">
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
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-caption transition-colors ${
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
    <section
      aria-labelledby="details"
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8"
    >
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
          <input value={fields.currentLevel} onChange={set("currentLevel")} className={CONTROL_CLASS} maxLength={60} />
        </Field>
        <Field label="Target level" hint="What you are interviewing for.">
          <input value={fields.targetLevel} onChange={set("targetLevel")} className={CONTROL_CLASS} maxLength={60} />
        </Field>
        <Field label="LinkedIn" hint="Optional. Stored, shown back to you, and not fetched.">
          <input
            value={fields.linkedinUrl}
            onChange={set("linkedinUrl")}
            placeholder="https://linkedin.com/in/…"
            className={CONTROL_CLASS}
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
