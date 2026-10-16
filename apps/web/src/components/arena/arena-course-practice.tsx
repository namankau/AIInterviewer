"use client";

import { useEffect, useState } from "react";

import type { ScenarioAnswerView, ScenarioCourseProgressView, ScenarioPlayView, ScenarioStepView } from "@untiered/shared";
import { answerScenarioStep, fetchScenarioCourseProgress, startScenario } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

export function ArenaCoursePractice({ courseSlug }: { courseSlug: string }) {
  const token = useAccessToken();
  const [progress, setProgress] = useState<ScenarioCourseProgressView | null>(null);
  const [play, setPlay] = useState<ScenarioPlayView | null>(null);
  const [step, setStep] = useState<ScenarioStepView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScenarioAnswerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetchScenarioCourseProgress(courseSlug, { accessToken: token })
      .then((value) => { if (active) { setProgress(value); setLoadStatus("ready"); } })
      .catch(() => { if (active) { setLoadStatus("error"); setError("We couldn't load your Arena progress. Please try again."); } });
    return () => { active = false; };
  }, [courseSlug, token, retryCount]);

  async function start() {
    if (!token || busy) return;
    setBusy(true); setError(null);
    try {
      const value = await startScenario(courseSlug, token);
      setPlay(value); setStep(value.step); setSelected(null); setFeedback(null);
    } catch { setError("We couldn't start a scenario. Try again."); }
    finally { setBusy(false); }
  }

  async function answer() {
    if (!token || !step || !selected || busy) return;
    setBusy(true); setError(null);
    try { setFeedback(await answerScenarioStep(courseSlug, token, step.id, selected)); }
    catch { setError("Your answer wasn't saved. Try again."); }
    finally { setBusy(false); }
  }

  function continuePlaying() {
    if (!feedback?.nextStep) return;
    setStep(feedback.nextStep); setSelected(null); setFeedback(null);
  }

  async function finish() {
    setPlay(null); setStep(null); setFeedback(null); setSelected(null);
    if (token) {
      try { setProgress(await fetchScenarioCourseProgress(courseSlug, { accessToken: token })); }
      catch { setError("We couldn't refresh your progress."); }
    }
  }

  return (
    <div className="space-y-7">
      {error ? <p role="alert" className="rounded-xl bg-danger/10 p-3 text-caption text-danger">{error}</p> : null}
      {!play ? (
        <>
          <div><p className="eyebrow text-accent">Course Arena</p><h2 className="mt-2 text-heading text-ink">One situation. Deeper questions.</h2><p className="mt-2 max-w-2xl text-body text-ink-muted">Work through a real-world situation and its follow-up decisions. Each answer shapes what you should review next.</p></div>
          {progress ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-sunken p-4"><p className="text-caption text-ink-muted">Scenarios completed</p><p className="text-title font-bold text-ink">{progress.scenariosDone}</p></div>
              <div className="rounded-xl border border-line bg-surface-sunken p-4"><p className="text-caption text-ink-muted">Concepts to practise</p><p className="mt-1 text-caption font-medium text-ink">{progress.weakestConcepts.map((c) => c.name).join(" · ") || "Start a scenario to see these"}</p></div>
            </div>
          ) : loadStatus === "loading" ? <p className="text-caption text-ink-muted">Loading your progress…</p> : null}
          {loadStatus === "error" ? (
            <button type="button" onClick={() => { setLoadStatus("loading"); setError(null); setRetryCount((count) => count + 1); }} className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-contrast hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Try again</button>
          ) : (
            <button type="button" disabled={!token || !progress || busy} onClick={start} className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-contrast hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60">{busy ? "Opening…" : progress?.activeScenarioId ? "Resume scenario" : "Start scenario"}</button>
          )}
        </>
      ) : play.scenario === null || step === null ? (
        <div className="space-y-4"><p className="text-body text-ink-muted">No more live scenarios are unlocked for this course yet. More are on the way.</p><button type="button" onClick={() => setPlay(null)} className="font-semibold text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Back to course Arena</button></div>
      ) : (
        <section aria-label="Scenario" className="space-y-6">
          <div className="rounded-2xl bg-[#102748] px-6 py-7 text-white"><p className="eyebrow text-blue-100">{play.scenario.context} · {play.scenario.estimatedMinutes} min</p><h2 className="mt-2 text-heading">{play.scenario.title}</h2><p className="mt-3 text-body leading-relaxed text-blue-100">{play.scenario.hook}</p></div>
          {step.contextNote ? <p className="rounded-xl border-l-4 border-accent bg-accent-wash p-4 text-body text-ink">{step.contextNote}</p> : null}
          <div><p className="eyebrow text-accent">{step.kind === "initial" ? "First decision" : `Probe ${step.position - 1}`} · {step.stepType.replaceAll("_", " ")}</p><h3 className="mt-2 text-title text-ink">{step.prompt}</h3></div>
          {step.codeSnippet ? <pre className="overflow-x-auto rounded-xl bg-[#102748] p-5 font-mono text-caption text-white"><code>{step.codeSnippet}</code></pre> : null}
          <fieldset disabled={feedback !== null || busy} className="space-y-3"><legend className="sr-only">Choose one answer</legend>
            {step.options.map((option) => <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-body transition-colors focus-within:ring-2 focus-within:ring-accent ${selected === option.id ? "border-accent bg-accent-wash" : "border-line bg-surface-raised"}`}><input type="radio" name={`step-${step.id}`} value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} className="mt-1 accent-accent" /><span>{option.text}</span></label>)}
          </fieldset>
          {!feedback ? <button type="button" disabled={!selected || busy} onClick={answer} className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60">{busy ? "Saving…" : "Check answer"}</button> : (
            <div role="status" className="space-y-3 rounded-xl border border-line bg-surface-sunken p-5"><p className={`font-bold ${feedback.correct ? "text-success" : "text-danger"}`}>{feedback.correct ? "Correct" : "Not quite"}</p><p className="text-body text-ink">Best answer: {step.options.find((option) => option.id === feedback.correctOptionId)?.text}</p><p className="text-body text-ink">{feedback.explanation}</p><p className="text-caption text-ink-muted"><strong>Bottleneck:</strong> {feedback.bottleneckNote}</p>
              {feedback.solutionBrief ? <div className="space-y-2 border-t border-line pt-4"><h3 className="text-heading text-ink">Solution in brief</h3><p className="text-body text-ink-muted">{feedback.solutionBrief}</p><p className="text-caption text-ink-muted">Concepts covered: {feedback.conceptsCovered.join(" · ")}</p></div> : null}
              <button type="button" onClick={feedback.nextStep ? continuePlaying : finish} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">{feedback.nextStep ? "Next probe" : "Back to course Arena"}</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
