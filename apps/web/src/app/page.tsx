import type { UsageCounts } from "@acemyinterview/shared";
import type { Metadata, Route } from "next";
import Link from "next/link";

import { courses, totalChapters, totalMinutes } from "@/content/courses";
import { fetchUsage } from "@/lib/api";

export const metadata: Metadata = {
  title: "AceMyInterview — mock interviews that push back",
  description:
    "Spoken mock interviews for the loops people actually sit: service-based IT, Big Four, " +
    "European competency rounds, global product. Every score in the report quotes what you said.",
};

/**
 * The public landing page.
 *
 * Rebuilt in the InterviewBit-style direction the owner asked for (task 044): a
 * confident marketing page with a navy hero, clear promise and a hero visual, rather
 * than a terminal-flavoured spec sheet. The claims underneath are unchanged from the
 * previous pass and still true statements only — no invented user counts, ratings or
 * testimonials (CLAUDE.md "quality bar").
 *
 * Server-rendered: organic search on "<employer> interview" is a primary acquisition
 * channel (PRD 11).
 */
export default async function LandingPage() {
  const usage = await fetchUsage();

  return (
    <div className="min-h-dvh bg-surface">
      <SiteHeader />
      <main>
        <Hero usage={usage} />
        <EmployerStrip />
        <VoiceSection />
        <TranscriptSample />
        <Coverage />
        <ReportContents />
        <Courses />
        <HowItWorks />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-heading font-bold tracking-tight text-ink">AceMyInterview</span>
          <span className="hidden font-mono text-micro tracking-widest text-ink-subtle uppercase sm:inline">
            beta
          </span>
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-8 md:flex">
          <Link href="/login" className="text-caption font-medium text-ink-muted hover:text-ink">
            Mock interviews
          </Link>
          <Link href={"/courses" as Route} className="text-caption font-medium text-ink-muted hover:text-ink">
            Courses
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken sm:inline-block"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-accent px-4 py-2.5 text-caption font-semibold text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ usage }: { usage: UsageCounts | null }) {
  return (
    <section className="bg-navy text-on-navy">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:py-28">
        <div className="flex flex-col gap-7">
          <span className="pill pill-navy w-fit">
            Voice · a face across the table · scored on what you actually said
          </span>
          <h1 className="text-hero text-balance text-on-navy">
            A mock interview that <span className="text-accent-strong">interrupts you.</span>
          </h1>
          <p className="max-w-xl text-body text-on-navy-muted">
            You speak your answers. It follows up on what you actually said, cuts in when you
            ramble, and pushes back on claims you cannot defend. Afterwards you get a report where
            every score is pinned to a sentence out of your own mouth.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link
              href="/login"
              className="rounded-lg bg-accent px-7 py-3.5 text-body font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-colors hover:bg-accent-strong"
            >
              Take a free interview
            </Link>
            <Link
              href={"/courses" as Route}
              className="rounded-lg border border-white/20 px-7 py-3.5 text-body font-semibold text-on-navy transition-colors hover:bg-white/10"
            >
              Explore free courses
            </Link>
          </div>
          <p className="text-caption text-on-navy-muted">
            Every round free while we build. Full report included, no card.
          </p>
          <UsageLine usage={usage} />
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/**
 * What the product has actually done.
 *
 * Shown only once there is something worth showing. "3 interviews completed" is worse
 * than no number at all — a counter is only social proof above a threshold, and below it
 * an honest silence beats a small brag.
 */
function UsageLine({ usage }: { usage: UsageCounts | null }) {
  const MEANINGFUL = 25;
  if (!usage || usage.interviewsCompleted < MEANINGFUL) return null;

  return (
    <p className="font-mono text-caption text-on-navy-muted">
      {usage.interviewsCompleted.toLocaleString()} interviews sat ·{" "}
      {usage.reportsGenerated.toLocaleString()} reports written
    </p>
  );
}

/**
 * The hero visual: a mock interview card with a waveform and a report score, built in
 * plain SVG/HTML. Not a stock abstract blob — it is a small, honest picture of the two
 * things the product actually does (listen to a spoken answer, score it with evidence).
 */
function HeroVisual() {
  const bars = [6, 14, 9, 22, 12, 28, 16, 10, 24, 14, 8, 18, 11, 26, 15, 9, 20, 13, 7, 17];
  return (
    <div className="relative mx-auto w-full max-w-sm lg:mx-0">
      <div className="card relative flex flex-col gap-5 bg-surface-raised p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Live round · turn 4
          </span>
          <span className="flex items-center gap-1.5 text-micro font-semibold text-positive">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
            Speaking
          </span>
        </div>

        <div className="flex h-16 items-end gap-1" role="img" aria-label="A candidate's voice waveform">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-full rounded-full bg-accent/70"
              style={{ height: `${h * 2.2}px` }}
            />
          ))}
        </div>

        <p className="text-caption text-ink-muted">
          &ldquo;We polled the ledger table every few seconds and retried on failure.&rdquo;
        </p>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-caption text-ink-subtle">Operational depth</span>
          <span className="font-mono text-title font-bold text-ink">2<span className="text-caption text-ink-subtle">/5</span></span>
        </div>
      </div>

      <div className="card absolute -bottom-8 -left-8 hidden w-52 flex-col gap-2 bg-surface-raised p-4 shadow-[var(--shadow-md)] sm:flex">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Report score
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-display font-bold text-accent">78</span>
          <span className="text-caption text-ink-subtle">/100</span>
        </div>
        <span className="pill pill-positive w-fit">Ready for the next round</span>
      </div>
    </div>
  );
}

/** True employer names we cover, as text wordmarks — no logos we do not own the rights to. */
function EmployerStrip() {
  const employers = [
    "TCS",
    "Infosys",
    "Accenture",
    "Deloitte",
    "Google",
    "Amazon",
    "Microsoft",
    "Zoho",
    "SAP",
    "Razorpay",
  ];
  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="pb-4 text-center font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Rounds built for interviews at
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {employers.map((name) => (
            <li key={name} className="text-heading font-bold text-ink-muted">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function VoiceSection() {
  const points = [
    {
      title: "You speak, it listens",
      body: "Browser recording straight to Gemini — no separate voice vendor. It hears the answer and speaks the next question back.",
    },
    {
      title: "A face across the table",
      body: "A drawn interviewer, never photoreal and never named, so nobody mistakes it for a person. Your own camera is optional and never leaves your browser.",
    },
    {
      title: "It interrupts",
      body: "Rambling gets cut in on. A claim you cannot defend gets a follow-up. That is the difference from a question bank on a timer.",
    },
  ];
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-3 pb-10">
          <span className="pill pill-accent w-fit">Voice mock interviews</span>
          <h2 className="text-display text-balance text-ink">Practice by talking, not by typing.</h2>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {points.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 bg-surface-raised p-6">
              <h3 className="text-heading font-bold text-ink">{p.title}</h3>
              <p className="text-caption text-ink-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A real exchange from a real session. The single most persuasive thing on the page,
 * because it is the thing competitors cannot fake with copy.
 */
function TranscriptSample() {
  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <h2 className="text-display text-balance text-ink">It listens to the answer.</h2>
          <p className="max-w-md text-body text-ink-muted">
            Not a question bank on a timer. The follow-up below came from one sentence the
            candidate said about their own architecture — and it came because the answer had gone
            thin.
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
              Project deep-dive · service-based IT
            </span>
            <span className="font-mono text-micro text-ink-subtle">turn 2</span>
          </div>
          <div className="flex flex-col divide-y divide-line">
            <Exchange
              speaker="Candidate"
              body="Yeah, so we used a background worker that polled the ledger table every few seconds. If it failed we just retried it. It was mostly fine."
            />
            <Exchange
              speaker="Interviewer"
              accent
              tag="challenge"
              body="Polling a ledger table taking hundreds of writes per second degrades the database and adds lag. How did you track which records still needed projecting?"
            />
          </div>
          <p className="border-t border-line px-5 py-3 text-caption text-ink-subtle">
            The report scored operational depth 2 out of 5 here, and quoted that answer as the
            reason.
          </p>
        </div>
      </div>
    </section>
  );
}

function Exchange({
  speaker,
  body,
  accent = false,
  tag,
}: {
  speaker: string;
  body: string;
  accent?: boolean;
  tag?: string;
}) {
  return (
    <div className={accent ? "bg-accent-wash px-5 py-4" : "px-5 py-4"}>
      <div className="flex items-center gap-2 pb-1.5">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {speaker}
        </span>
        {tag ? <span className="pill pill-accent">{tag}</span> : null}
      </div>
      <p className="text-body text-ink">{body}</p>
    </div>
  );
}

/** Names real employers and real round types. An adjective would say nothing. */
function Coverage() {
  const archetypes = [
    {
      label: "Service-based IT",
      examples: "TCS · Infosys · Wipro · Cognizant",
      rounds: "Project walkthrough, techno-managerial, HR fit",
    },
    {
      label: "Consulting and Big Four",
      examples: "Deloitte · EY · PwC · KPMG · Accenture",
      rounds: "Case discussion, client scenario, manager round",
    },
    {
      label: "Global product",
      examples: "Google · Amazon · Microsoft · Atlassian",
      rounds: "Coding, system design, behavioural, bar raiser",
    },
    {
      label: "European employers",
      examples: "Booking · Adyen · SAP · Zalando",
      rounds: "Competency rounds, values fit, relocation and visa",
    },
    {
      label: "Indian product",
      examples: "Zoho · Razorpay · Zerodha · Swiggy",
      rounds: "Practical coding, product sense, founder round",
    },
    {
      label: "GCC and captive",
      examples: "Global banks, retail and pharma captives",
      rounds: "Domain depth, stakeholder management, compliance",
    },
  ];

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-3 pb-10">
          <h2 className="text-display text-balance text-ink">The loops most tools skip.</h2>
          <p className="max-w-2xl text-body text-ink-muted">
            An Infosys techno-managerial panel is not a Google system design round, and preparing
            for one does not prepare you for the other. Each archetype runs its own structure and
            its own rubric.
          </p>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {archetypes.map((item) => (
            <li key={item.label} className="card flex flex-col gap-2 p-5">
              <span className="text-heading font-bold text-ink">{item.label}</span>
              <span className="font-mono text-caption text-ink-subtle">{item.examples}</span>
              <span className="text-caption text-ink-muted">{item.rounds}</span>
            </li>
          ))}
        </ul>

        <p className="max-w-2xl pt-6 text-caption text-ink-subtle">
          Name an employer we do not recognise and the round still runs — on archetype patterns,
          and it tells you that is what it is doing rather than inventing detail about a company
          we know nothing about.
        </p>
      </div>
    </section>
  );
}

function ReportContents() {
  const sections = [
    {
      n: "01",
      title: "Competency scores, each with a quote",
      body: "Scored against your function and level. A score that cannot be tied to something you said is dropped rather than shown.",
    },
    {
      n: "02",
      title: "Where you needed a hand",
      body: "Counted from the round itself: which answers stood alone, where you were nudged, and what you built on the nudge.",
    },
    {
      n: "03",
      title: "Answer by answer",
      body: "What worked, what was vague, what a real interviewer would have probed, and a stronger framing for the weakest answers.",
    },
    {
      n: "04",
      title: "How you came across",
      body: "Structure, filler density, pace, rambling, and how you handled not knowing something.",
    },
    {
      n: "05",
      title: "What to work on next",
      body: "The specific competencies to fix before the next attempt, and which round to take next.",
    },
  ];

  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <span className="pill pill-accent w-fit">The feedback report</span>
          <h2 className="text-display text-balance text-ink">The report is the product.</h2>
          <p className="max-w-md text-body text-ink-muted">
            Encouraging summaries are worthless and candidates know it. Everything here is either
            traceable to your transcript or it does not appear.
          </p>
        </div>

        <ol className="card flex flex-col divide-y divide-line">
          {sections.map((section) => (
            <li key={section.n} className="flex gap-5 p-5">
              <span className="pt-0.5 font-mono text-caption text-accent">{section.n}</span>
              <div className="flex flex-col gap-1">
                <h3 className="text-heading font-bold text-ink">{section.title}</h3>
                <p className="max-w-xl text-body text-ink-muted">{section.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Free courses (task 045).
 *
 * Each card links to its own course. It used to send both to `/courses` — the comment
 * said "links out even if the route isn't live yet", which was true when it was written
 * and quietly stopped being true once the courses shipped. The effect was that clicking
 * either card landed you on the same catalogue page, so the two cards looked broken.
 *
 * The titles and taglines are read from the course content itself rather than repeated
 * here, so the landing page cannot drift out of step with what the course is actually
 * called.
 */
function Courses() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-3 pb-10">
          <span className="pill pill-highlight w-fit">Free courses</span>
          <h2 className="text-display text-balance text-ink">Study before you sit the round.</h2>
          <p className="max-w-2xl text-body text-ink-muted">
            Free, self-paced material for the two things a coding round tests most.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {courses.map((course) => (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}` as Route}
              className="card flex flex-col gap-2 p-6 transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <h3 className="text-heading font-bold text-ink">{course.title}</h3>
              <p className="text-caption text-ink-muted">{course.tagline}</p>
              <span className="pt-2 text-caption font-semibold text-accent">
                {totalChapters(course)} chapters · {totalMinutes(course)} min
              </span>
              <span className="text-caption font-semibold text-accent">Start course →</span>
            </Link>
          ))}
          <Link
            href={"/arena" as Route}
            className="card flex flex-col gap-2 p-6 transition-shadow hover:shadow-[var(--shadow-md)]"
          >
            <span className="pill pill-highlight w-fit">New</span>
            <h3 className="text-heading font-bold text-ink">The Arena</h3>
            <p className="text-caption text-ink-muted">
              Short, gamified rounds derived from every chapter above — spot the mistake, predict the output,
              read a diagram one step ahead.
            </p>
            <span className="pt-2 text-caption font-semibold text-accent">Play now →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Pick company and role", body: "Chosen fresh for this session — no setup, no target list to maintain." },
    { n: "02", title: "Take the round", body: "Up to 8 spoken exchanges. It adapts to what you say and interrupts when it needs to." },
    { n: "03", title: "Read the report", body: "Every score quotes your own transcript. Free, in full, every time." },
  ];
  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="pb-10 text-display text-balance text-ink">How it works.</h2>
        <ol className="grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-col gap-2">
              <span className="font-mono text-display font-bold text-accent">{s.n}</span>
              <h3 className="text-heading font-bold text-ink">{s.title}</h3>
              <p className="text-caption text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * There is no paid tier yet, so this promises exactly what the product does: every round,
 * free, while it is being built. Saying "free trial" or naming a future price would be
 * selling something that does not exist.
 */
function CtaBand() {
  return (
    <section className="bg-navy text-on-navy">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20">
        <h2 className="text-display text-balance text-on-navy">Every round is free right now.</h2>
        <p className="max-w-xl text-body text-on-navy-muted">
          Not a trial round, and not a sample report — the whole thing, as many times as you
          want, while we are still building it. No card. When there is something worth charging
          for, we will say so before we charge for it.
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-accent px-7 py-3.5 text-body font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-colors hover:bg-accent-strong"
        >
          Start an interview
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-heading font-bold text-ink">AceMyInterview</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/login" className="text-caption text-ink-muted hover:text-ink">
              Mock interviews
            </Link>
            <Link href={"/courses" as Route} className="text-caption text-ink-muted hover:text-ink">
              Courses
            </Link>
            <Link href="/login" className="text-caption text-ink-muted hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <span className="text-caption text-ink-subtle">
            AceMyInterview — practice interviews, not interview help.
          </span>
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Recorded with consent · deletable at any time
          </span>
        </div>
      </div>
    </footer>
  );
}
