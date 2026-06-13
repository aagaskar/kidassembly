import { Step } from "./types";

/**
 * Knowledge-graph node (§5.4, §6). One skill per lesson: the lesson teaches
 * it, the item generator keeps it alive in the review pool.
 */
export interface Skill {
  id: string; // same as the lesson id, e.g. "u02.first_steps"
  unit: number;
  /** Child-facing name ("can follow an arrow to a box") for the dashboard. */
  title: string;
  /** Hard gates: every prereq must be mastered before this skill unlocks. */
  prereqs: string[];
  /**
   * Layering-credit edges: succeeding at THIS skill counts as a review of
   * each subsumed skill (§5.4). Keeps review volume bounded.
   */
  subsumes: string[];
  /** Latency-gated micro-skill (Unit 0 conversions etc.)? */
  automaticity: boolean;
  /** Consecutive review successes needed to climb out of relearning. */
  relearnRule: number;
  /**
   * Parameterized review-item generator (§5.3): deterministic from seed,
   * returns a lesson-player `Step` so review reuses the same UI. Skills
   * without a generator (pure reading lessons) never enter the review pool.
   */
  makeReviewItem?: (seed: number) => Step;
}

export type Mastery = "locked" | "learning" | "mastered" | "relearning";

export interface Attempt {
  skillId: string;
  itemKind: string;
  correct: boolean;
  latencyMs: number;
  at: string; // ISO
  context: "lesson" | "review" | "placement";
}

export interface StudentSkillState {
  skillId: string;
  mastery: Mastery;
  fsrs: { stability: number; difficulty: number; due: string; lastReview: string } | null;
  /** Consecutive successes while learning/relearning. */
  streak: number;
  /**
   * Set when the student struggled in a later lesson that builds on this
   * skill (its `subsumes` edge points here) — the home screen marks the
   * lesson as worth a redo. Cleared by a correct review.
   */
  suggestedReview?: boolean;
}

/** Validate graph integrity (no dangling edges, no prereq cycles). */
export function checkGraph(skills: Skill[]): string[] {
  const problems: string[] = [];
  const byId = new Map(skills.map((s) => [s.id, s]));
  for (const s of skills) {
    for (const p of [...s.prereqs, ...s.subsumes]) {
      if (!byId.has(p)) problems.push(`${s.id} references missing skill ${p}`);
    }
  }
  // Cycle check over prereq edges (DFS, three colors).
  const color = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): boolean => {
    const c = color.get(id) ?? 0;
    if (c === 1) return false;
    if (c === 2) return true;
    color.set(id, 1);
    for (const p of byId.get(id)?.prereqs ?? []) {
      if (!visit(p)) return false;
    }
    color.set(id, 2);
    return true;
  };
  for (const s of skills) {
    if (!visit(s.id)) {
      problems.push(`prerequisite cycle involving ${s.id}`);
      break;
    }
  }
  return problems;
}
