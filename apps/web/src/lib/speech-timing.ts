/**
 * Measuring when a candidate was speaking, from the microphone level alone.
 *
 * The report's spoken-English section shows a speaking pace and pauses, and those have to
 * be measured rather than guessed by a model. This is the measuring half: it folds the
 * same meter readings that drive the speaking indicator into a handful of timings, which
 * go up with the answer. It judges nothing — whether a pace is quick or a pause long is
 * decided on the server, with the transcript in hand.
 *
 * Pure, so it can be tested without a microphone.
 */

import { SPEECH_LEVEL } from "@/lib/silence";

/** A silence at least this long between two sounds is a pause, not the gap between words. */
export const PAUSE_MS = 1_000;

/**
 * Readings further apart than this mean the meter was not sampling steadily (a tab in
 * the background throttles animation frames), so a silence in that gap may be nothing of
 * the kind. Such an answer sends no timing rather than a wrong one.
 */
export const MAX_SAMPLE_GAP_MS = 500;

/** What is sent with the answer. Milliseconds throughout; mirrors `AnswerTiming.kt`. */
export interface AnswerTiming {
  recordedMs: number;
  firstSoundMs: number | null;
  speakingMs: number;
  pauseCount: number;
  longestPauseMs: number;
  totalPauseMs: number;
}

export interface TimingState {
  startedAt: number;
  lastSampleAt: number;
  widestGapMs: number;
  firstSpeechAt: number | null;
  lastSpeechAt: number | null;
  pauseCount: number;
  longestPauseMs: number;
  totalPauseMs: number;
}

export function startTiming(now: number): TimingState {
  return {
    startedAt: now,
    lastSampleAt: now,
    widestGapMs: 0,
    firstSpeechAt: null,
    lastSpeechAt: null,
    pauseCount: 0,
    longestPauseMs: 0,
    totalPauseMs: 0,
  };
}

/** Folds one meter reading (0–1, as `use-interview-capture` produces it) into the timing. */
export function foldLevel(state: TimingState, level: number, now: number): TimingState {
  const next = {
    ...state,
    lastSampleAt: now,
    widestGapMs: Math.max(state.widestGapMs, now - state.lastSampleAt),
  };
  if (level < SPEECH_LEVEL) return next;

  if (state.lastSpeechAt !== null) {
    const gap = now - state.lastSpeechAt;
    if (gap >= PAUSE_MS) {
      next.pauseCount += 1;
      next.longestPauseMs = Math.max(next.longestPauseMs, gap);
      next.totalPauseMs += gap;
    }
  }
  next.firstSpeechAt = state.firstSpeechAt ?? now;
  next.lastSpeechAt = now;
  return next;
}

/**
 * The timing for the answer that has just ended, or null when the meter did not sample
 * steadily enough for its silences to mean anything.
 */
export function finishTiming(state: TimingState, now: number): AnswerTiming | null {
  const widestGapMs = Math.max(state.widestGapMs, now - state.lastSampleAt);
  if (widestGapMs > MAX_SAMPLE_GAP_MS) return null;

  const recordedMs = Math.round(now - state.startedAt);
  if (recordedMs <= 0) return null;
  if (state.firstSpeechAt === null || state.lastSpeechAt === null) {
    return { recordedMs, firstSoundMs: null, speakingMs: 0, pauseCount: 0, longestPauseMs: 0, totalPauseMs: 0 };
  }
  // Rounded so the parts never add up to more than the whole they are measured within.
  const firstSoundMs = Math.floor(state.firstSpeechAt - state.startedAt);
  const speakingMs = Math.min(Math.round(state.lastSpeechAt - state.firstSpeechAt), recordedMs - firstSoundMs);
  const totalPauseMs = Math.min(Math.round(state.totalPauseMs), speakingMs);
  return {
    recordedMs,
    firstSoundMs,
    speakingMs,
    pauseCount: state.pauseCount,
    longestPauseMs: Math.min(Math.round(state.longestPauseMs), totalPauseMs),
    totalPauseMs,
  };
}
