import type { UsageCounts } from "@acemyinterview/shared";
import type { Metadata } from "next";
import Link from "next/link";

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
 * Every claim here is one the product can actually demonstrate in the free session. No
 * gradient hero, no three identical feature cards, no adjectives standing in for
 * evidence — a candidate deciding whether to trust this with their career reads
 * specifics, and specifics are the only thing that separates us from the category.
 *
 * Server-rendered: organic search on "<employer> interview" is a primary acquisition
 * channel (PRD 11).
 */
export default async function LandingPage() {
  // Server-rendered along with everything else here: organic search is a primary channel
  // (PRD 11), and a number that appears only after hydration is a number crawlers and
  // slow connections never see. Null when the API is unreachable — the page does not
  // depend on it.
  const usage = await fetchUsage();

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main>
        <Hero usage={usage} />
        <TranscriptSample />
        <Coverage />
        <ReportContents />
        <Pricing />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <span className="flex items-baseline gap-2">
          <span className="text-heading font-semibold tracking-tight text-ink">AceMyInterview</span>
          <span className="hidden font-mono text-micro tracking-widest text-ink-subtle uppercase sm:inline">
            beta
          </span>
        </span>
        <Link
          href="/login"
          className="rounded-md border border-line-strong px-4 py-2 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

function Hero({ usage }: { usage: UsageCounts | null }) {
  return (
    <section className="bg-grid border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-28">
        <div className="flex flex-col gap-7">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Voice only · no camera · scored against what you actually said
          </p>
          <h1 className="text-hero text-balance text-ink">A mock interview that interrupts you.</h1>
          <p className="max-w-xl text-body text-ink-muted">
            You speak your answers. It follows up on what you actually said, cuts in when you
            ramble, and pushes back on claims you cannot defend. Afterwards you get a report where
            every score is pinned to a sentence out of your own mouth.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="rounded-md bg-accent px-6 py-3 text-body font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
            >
              Take a free interview
            </Link>
            <span className="text-caption text-ink-subtle">
              Every round free while we build. Full report included, no card.
            </span>
          </div>

          <UsageLine usage={usage} />
        </div>

        <SpecPanel />
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
    <p className="font-mono text-caption text-ink-subtle">
      {usage.interviewsCompleted.toLocaleString()} interviews sat ·{" "}
      {usage.reportsGenerated.toLocaleString()} reports written
    </p>
  );
}

/** Reads as a spec sheet rather than a marketing card — this is a tool. */
function SpecPanel() {
  const rows: Array<[string, string]> = [
    ["Modality", "Spoken. Audio only, no camera."],
    ["Adapts on", "Your previous answer"],
    ["Interrupts", "Rambling, unsupported claims"],
    ["Helps", "Hints, then records that it did"],
    ["Scores", "Against a function + level rubric"],
    ["Evidence", "A quote per competency"],
    ["Round length", "Up to 8 exchanges"],
  ];

  return (
    <aside className="self-start rounded-lg border border-line bg-surface-raised">
      <div className="border-b border-line px-5 py-3">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          How the round runs
        </span>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([term, detail]) => (
          <div key={term} className="flex items-baseline justify-between gap-6 px-5 py-3">
            <dt className="text-caption text-ink-subtle">{term}</dt>
            <dd className="text-right text-caption text-ink">{detail}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/**
 * A real exchange from a real session. The single most persuasive thing on the page,
 * because it is the thing competitors cannot fake with copy.
 */
function TranscriptSample() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <h2 className="text-display text-balance text-ink">It listens to the answer.</h2>
          <p className="max-w-md text-body text-ink-muted">
            Not a question bank on a timer. The follow-up below came from one sentence the
            candidate said about their own architecture — and it came because the answer had gone
            thin.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
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
        {tag ? (
          <span className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-micro text-ink-muted">
            {tag}
          </span>
        ) : null}
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
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-3 pb-10">
          <h2 className="text-display text-balance text-ink">The loops most tools skip.</h2>
          <p className="max-w-2xl text-body text-ink-muted">
            An Infosys techno-managerial panel is not a Google system design round, and preparing
            for one does not prepare you for the other. Each archetype runs its own structure and
            its own rubric.
          </p>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {archetypes.map((item) => (
            <li key={item.label} className="flex flex-col gap-2 bg-surface-raised p-5">
              <span className="text-heading text-ink">{item.label}</span>
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
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <h2 className="text-display text-balance text-ink">The report is the product.</h2>
          <p className="max-w-md text-body text-ink-muted">
            Encouraging summaries are worthless and candidates know it. Everything here is either
            traceable to your transcript or it does not appear.
          </p>
        </div>

        <ol className="flex flex-col divide-y divide-line border-y border-line">
          {sections.map((section) => (
            <li key={section.n} className="flex gap-5 py-5">
              <span className="pt-0.5 font-mono text-caption text-ink-subtle">{section.n}</span>
              <div className="flex flex-col gap-1">
                <h3 className="text-heading text-ink">{section.title}</h3>
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
 * There is no paid tier yet, so this promises exactly what the product does: every round,
 * free, while it is being built. Saying "free trial" or naming a future price would be
 * selling something that does not exist.
 */
function Pricing() {
  return (
    <section>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20">
        <h2 className="text-display text-balance text-ink">Every round is free right now.</h2>
        <p className="max-w-xl text-body text-ink-muted">
          Not a trial round, and not a sample report — the whole thing, as many times as you
          want, while we are still building it. No card. When there is something worth charging
          for, we will say so before we charge for it.
        </p>
        <Link
          href="/login"
          className="rounded-md bg-accent px-6 py-3 text-body font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <span className="text-caption text-ink-subtle">
          AceMyInterview — practice interviews, not interview help.
        </span>
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Recorded with consent · deletable at any time
        </span>
      </div>
    </footer>
  );
}
