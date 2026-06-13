import { DrillKind } from "./types";
import { DrillQuestion, makeDrillQuestion } from "./grade";
import { Skill } from "./skills";

/**
 * Placement diagnostic (§5.4): an adaptive ladder of probe questions.
 * Each rung probes one unit's core skill with two parameterized items; pass
 * both to climb. The first miss (or running out of rungs) ends the probe,
 * and every skill in the units BELOW the final rung is seeded as mastered —
 * so a 12-year-old with prior experience doesn't crawl through Unit 0.
 */

export interface PlacementRung {
  unit: number;
  label: string;
  drills: DrillKind[];
}

export const PLACEMENT_RUNGS: PlacementRung[] = [
  { unit: 0, label: "binary numbers", drills: ["bin2dec", "dec2bin"] },
  { unit: 1, label: "boxes and addresses", drills: ["addrvalue", "addrvalue"] },
  { unit: 2, label: "instructions", drills: ["opcode", "opcode"] },
  { unit: 5, label: "wraparound and counting", drills: ["twos", "twos"] },
  { unit: 6, label: "following arrows", drills: ["mlevel", "mlevel"] },
];

export interface PlacementState {
  rung: number; // index into PLACEMENT_RUNGS
  question: number; // 0 or 1 within the rung
  /** Highest unit the student cleared (exclusive grant boundary). */
  clearedBelowUnit: number;
  finished: boolean;
}

export function startPlacement(): PlacementState {
  return { rung: 0, question: 0, clearedBelowUnit: 0, finished: false };
}

export function currentProbe(state: PlacementState, seed: number): DrillQuestion {
  const rung = PLACEMENT_RUNGS[state.rung];
  return makeDrillQuestion(rung.drills[state.question], seed, 15);
}

export function answerProbe(state: PlacementState, correct: boolean): PlacementState {
  if (state.finished) return state;
  if (!correct) {
    return { ...state, finished: true };
  }
  if (state.question + 1 < PLACEMENT_RUNGS[state.rung].drills.length) {
    return { ...state, question: state.question + 1 };
  }
  // Rung cleared: everything below the NEXT rung's unit is granted.
  const next = state.rung + 1;
  const clearedBelowUnit =
    next < PLACEMENT_RUNGS.length ? PLACEMENT_RUNGS[next].unit : PLACEMENT_RUNGS[state.rung].unit + 1;
  if (next >= PLACEMENT_RUNGS.length) {
    return { ...state, clearedBelowUnit, finished: true };
  }
  return { rung: next, question: 0, clearedBelowUnit, finished: false };
}

/** Skill ids granted by a finished placement. */
export function grantedSkills(state: PlacementState, skills: Skill[]): string[] {
  return skills.filter((s) => s.unit < state.clearedBelowUnit).map((s) => s.id);
}
