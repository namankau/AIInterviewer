import type { ReportSpokenEnglish } from "@acemyinterview/shared";

/**
 * The report's "Spoken English" section (PRD 09).
 *
 * Every figure here was measured — the timings from the microphone level while each
 * answer was recorded, the counts from the transcript — and arrives computed by the
 * server. This component formats; it never estimates. A figure the server could not
 * measure arrives as null and is shown as "Not measured" beside the server's reason,
 * never as a zero or a guess.
 *
 * The pace band is described in words, not colour: "above the range" is information, and
 * colouring it red would turn a rough guide into a verdict (CLAUDE.md).
 */
export function SpokenEnglishPanel({ spoken }: { spoken: ReportSpokenEnglish | null | undefined }) {
  if (!spoken) {
    return (
      <PanelFrame lead="How you spoke: pace, pauses and your English.">
        <p className="max-w-prose text-body text-ink-muted">
          This report was written before spoken-English feedback existed, so it has no pace, pause
          or language figures. Rounds you sit from now on include them.
        </p>
      </PanelFrame>
    );
  }

  return (
    <PanelFrame lead={spoken.scope}>
      {spoken.timingNote ? (
        <p className="max-w-prose rounded-xl border border-line bg-surface p-4 text-caption text-ink-muted">
          {spoken.timingNote}
        </p>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2">
        <Measure
          term="Speaking pace"
          value={spoken.wordsPerMinute !== null ? `${spoken.wordsPerMinute} words per minute` : null}
          badge={spoken.paceBand ? PACE_BAND[spoken.paceBand] : null}
          basis={spoken.paceNote}
        />
        <Measure
          term="Pauses of a second or longer"
          value={spoken.pauseCount !== null ? String(spoken.pauseCount) : null}
          detail={pauseDetail(spoken)}
          basis="A pause is a silence of at least a second between two sounds, measured from your microphone level. Pausing to think is normal in an interview."
        />
        <Measure
          term="Wait before your first word"
          value={spoken.medianFirstWordSeconds !== null ? seconds(spoken.medianFirstWordSeconds) : null}
          basis="The median across your answers, from when the microphone opened to the first sound loud enough to be speech."
        />
        {spoken.languageAssessed ? (
          <Measure
            term="Hesitation sounds"
            value={spoken.hesitationCount !== null ? String(spoken.hesitationCount) : null}
            detail={
              spoken.hesitationsPer100Words !== null
                ? `${spoken.hesitationsPer100Words} per 100 words, across ${spoken.wordCount} words`
                : null
            }
            basis="um, uh, er and hmm, counted in the automatic transcript of your answers, which may leave some out."
          />
        ) : null}
      </dl>

      {spoken.answersTimed > 0 && spoken.answers.length > 0 ? <PerAnswer spoken={spoken} /> : null}

      {spoken.languageAssessed ? <Observations spoken={spoken} /> : null}
    </PanelFrame>
  );
}

const PACE_BAND: Record<NonNullable<ReportSpokenEnglish["paceBand"]>, string> = {
  below: "Below the conversational range",
  within: "Within the conversational range",
  above: "Above the conversational range",
};

function seconds(value: number): string {
  return `${value.toFixed(1)} seconds`;
}

function pauseDetail(spoken: ReportSpokenEnglish): string | null {
  const parts: string[] = [];
  if (spoken.pauseCount && spoken.longestPauseSeconds !== null) {
    parts.push(`longest ${seconds(spoken.longestPauseSeconds)}`);
  }
  if (spoken.pauseSharePercent !== null) parts.push(`${spoken.pauseSharePercent}% of your speaking time`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function PanelFrame({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="spoken-english"
      className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="spoken-english" className="text-title text-ink">
          Spoken English
        </h2>
        <p className="max-w-prose text-caption text-ink-subtle">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Measure({
  term,
  value,
  detail = null,
  badge = null,
  basis,
}: {
  term: string;
  value: string | null;
  detail?: string | null;
  badge?: string | null;
  basis: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
      <dt className="text-caption font-medium text-ink-subtle">{term}</dt>
      <dd className="flex flex-col gap-2">
        <span className="text-heading text-ink tabular-nums">{value ?? "Not measured"}</span>
        {badge ? (
          <span className="w-fit rounded-full border border-line-strong px-2.5 py-0.5 text-micro font-medium text-ink-muted">
            {badge}
          </span>
        ) : null}
        {detail ? <span className="text-caption text-ink-muted">{detail}</span> : null}
        <span className="text-caption text-ink-subtle">{basis}</span>
      </dd>
    </div>
  );
}

function PerAnswer({ spoken }: { spoken: ReportSpokenEnglish }) {
  const dash = <span aria-label="not measured">–</span>;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-ink-subtle marker:content-none hover:text-ink [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 8 8"
          className="h-2 w-2 shrink-0 fill-current transition-transform group-open:rotate-90"
        >
          <polygon points="0,0 8,4 0,8" />
        </svg>
        Answer by answer
      </summary>
      <div className="overflow-x-auto pt-3">
        <table className="w-full min-w-[32rem] text-left text-caption">
          <caption className="sr-only">Measured timing for each answer</caption>
          <thead className="text-ink-subtle">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-medium">Question</th>
              <th scope="col" className="py-2 pr-4 font-medium">Words</th>
              <th scope="col" className="py-2 pr-4 font-medium">Words per minute</th>
              <th scope="col" className="py-2 pr-4 font-medium">Pauses</th>
              <th scope="col" className="py-2 pr-4 font-medium">Longest pause</th>
              <th scope="col" className="py-2 font-medium">First word after</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted tabular-nums">
            {spoken.answers.map((answer) => (
              <tr key={answer.turnIndex} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pr-4 font-medium text-ink">{answer.turnIndex + 1}</th>
                <td className="py-2 pr-4">{answer.words}</td>
                <td className="py-2 pr-4">{answer.wordsPerMinute ?? dash}</td>
                <td className="py-2 pr-4">{answer.pauseCount ?? dash}</td>
                <td className="py-2 pr-4">
                  {answer.longestPauseSeconds !== null && answer.pauseCount ? seconds(answer.longestPauseSeconds) : dash}
                </td>
                <td className="py-2">{answer.firstWordSeconds !== null ? seconds(answer.firstWordSeconds) : dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pt-2 text-caption text-ink-subtle">
          A dash means that answer could not be measured — too short to pace, or no timing was
          recorded for it.
        </p>
      </div>
    </details>
  );
}

function Observations({ spoken }: { spoken: ReportSpokenEnglish }) {
  if (spoken.observations.length === 0) {
    return (
      <p className="max-w-prose text-body text-ink-muted">
        No observation about your English could be tied to a quote from your answers, so none is
        shown.
      </p>
    );
  }
  return (
    <section aria-label="How you used English" className="flex flex-col gap-4 border-t border-line pt-6">
      <h3 className="text-heading text-ink">How you used English</h3>
      <ul className="flex flex-col divide-y divide-line">
        {spoken.observations.map((item, index) => (
          <li key={`${item.aspect}-${index}`} className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="pill w-fit">{item.aspectLabel}</span>
              {item.turnIndex !== null ? (
                <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                  question {item.turnIndex + 1}
                </span>
              ) : null}
            </div>
            <blockquote className="rounded-r-lg border-l-4 border-accent bg-accent-wash py-3 pl-5 text-body text-ink italic">
              &ldquo;{item.evidenceQuote}&rdquo;
            </blockquote>
            <p className="max-w-prose text-body text-ink-muted">{item.finding}</p>
            <p className="max-w-prose text-body text-ink">
              <span className="font-medium">Try: </span>
              {item.suggestion}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
