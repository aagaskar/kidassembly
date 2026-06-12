/**
 * FSRS-style spaced-repetition scheduler (§5.4 of the design doc).
 *
 * This is a compact reimplementation of the FSRS *mechanism* — a memory
 * model with per-skill stability (S, in days) and difficulty (D, 1–10),
 * where the next review interval grows with S and the growth rate shrinks
 * as D rises. The published FSRS parameters were fit on flashcard data,
 * not coding exercises (§2 P3), so these constants are deliberately simple
 * and tunable rather than a transcription of the reference weights.
 */

export type Rating = "again" | "good" | "easy";

export interface FsrsState {
  /** Stability: the interval (days) at which recall ≈ 90%. */
  stability: number;
  /** Difficulty 1 (easy) – 10 (hard). */
  difficulty: number;
  /** ISO date-time the skill is next due for review. */
  due: string;
  /** ISO date-time of the last review (or initial mastery). */
  lastReview: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Desired retention; intervals target this recall probability. */
const REQUEST_RETENTION = 0.9;

const MIN_STABILITY = 0.25; // 6 hours
const MAX_STABILITY = 365; // cap intervals at a year

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const clampS = (s: number) => Math.min(MAX_STABILITY, Math.max(MIN_STABILITY, s));

/** Power forgetting curve: retrievability after `elapsedDays` at stability S. */
export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/** Interval (days) that brings retrievability down to the requested retention. */
export function intervalForStability(stability: number): number {
  return 9 * stability * (1 / REQUEST_RETENTION - 1);
}

function dueFrom(now: Date, stability: number): string {
  const days = Math.max(intervalForStability(stability), MIN_STABILITY);
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

/** First schedule after a skill is mastered. */
export function initialFsrs(now: Date, rating: Rating = "good"): FsrsState {
  const stability = rating === "easy" ? 4 : 1;
  const difficulty = rating === "easy" ? 4 : 5;
  return {
    stability,
    difficulty,
    due: dueFrom(now, stability),
    lastReview: now.toISOString(),
  };
}

/**
 * Update the memory state after a review.
 *
 * - success when retrievability was low (a hard-won recall) grows stability
 *   more than an "easy" early review — the spacing effect;
 * - higher difficulty damps growth;
 * - failure collapses stability and bumps difficulty.
 */
export function reviewFsrs(state: FsrsState, rating: Rating, now: Date): FsrsState {
  const elapsedDays = Math.max(0, (now.getTime() - new Date(state.lastReview).getTime()) / DAY_MS);
  const r = retrievability(elapsedDays, state.stability);

  if (rating === "again") {
    const difficulty = clampD(state.difficulty + 1);
    const stability = clampS(state.stability * 0.3);
    return { stability, difficulty, due: dueFrom(now, stability), lastReview: now.toISOString() };
  }

  const difficulty = clampD(state.difficulty - (rating === "easy" ? 0.5 : 0.2));
  // Growth factor: bigger when recall was harder (low R), smaller for hard
  // skills (high D), with diminishing returns as S grows (S^-0.1).
  const hardness = Math.exp(1.5 * (1 - r));
  const ease = (11 - difficulty) / 6;
  const bonus = rating === "easy" ? 1.4 : 1;
  const growth = 1 + ease * hardness * bonus * Math.pow(state.stability, -0.1);
  const stability = clampS(state.stability * growth);
  return { stability, difficulty, due: dueFrom(now, stability), lastReview: now.toISOString() };
}

/**
 * Layering credit (§5.4): success on a subsuming skill refreshes a subsumed
 * skill's schedule, with a gentler stability bump than a direct review.
 */
export function layeredCredit(state: FsrsState, now: Date): FsrsState {
  const elapsedDays = Math.max(0, (now.getTime() - new Date(state.lastReview).getTime()) / DAY_MS);
  const r = retrievability(elapsedDays, state.stability);
  const growth = 1 + 0.5 * Math.exp(1 - r) * Math.pow(state.stability, -0.1);
  const stability = clampS(state.stability * growth);
  return { ...state, stability, due: dueFrom(now, stability), lastReview: now.toISOString() };
}

export function isDue(state: FsrsState, now: Date): boolean {
  return new Date(state.due).getTime() <= now.getTime();
}

export function daysOverdue(state: FsrsState, now: Date): number {
  return (now.getTime() - new Date(state.due).getTime()) / DAY_MS;
}
