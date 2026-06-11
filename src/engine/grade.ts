import { Blank, isBlank, PredictAsk, SimSetup, TargetCheck } from "./types";
import { VMState } from "../vm/types";
import { createVM, pokeMemory, run, step } from "../vm/vm";
import { makeRng, randInt } from "./rng";

export function buildState(sim: SimSetup): VMState {
  let s = createVM(sim.program ?? [], sim.seed ?? 1);
  if (sim.memory) {
    for (const [addr, value] of Object.entries(sim.memory)) {
      s = pokeMemory(s, Number(addr), value);
    }
  }
  return s;
}

export function stepN(state: VMState, n: number): VMState {
  let s = state;
  for (let i = 0; i < n && !s.halted; i++) s = step(s);
  return s;
}

/** The expected answer for a predict item, computed from the VM itself. */
export function expectedPrediction(sim: SimSetup, stepsToRun: number, ask: PredictAsk): number {
  const final = stepN(buildState(sim), stepsToRun);
  switch (ask.what) {
    case "A":
      return final.A;
    case "PC":
      return final.PC;
    case "cell":
      return final.memory[ask.addr];
  }
}

export function gradePredict(
  sim: SimSetup,
  stepsToRun: number,
  ask: PredictAsk,
  answer: number
): boolean {
  return answer === expectedPrediction(sim, stepsToRun, ask);
}

/**
 * Substitute the student's values into the blanks, then run-and-assert
 * against every case. Returns the final state of the first case so the UI
 * can show the student what their program actually did.
 */
export function gradeFillBlank(
  program: (number | Blank)[],
  check: TargetCheck,
  answers: number[]
): { pass: boolean; finalState: VMState } {
  const bytes: number[] = [];
  let i = 0;
  for (const cell of program) {
    bytes.push(isBlank(cell) ? (answers[i++] ?? 0) : cell);
  }
  let allPass = true;
  let firstFinal: VMState | null = null;
  for (const c of check.cases) {
    let start = createVM(bytes);
    if (c.memory) {
      for (const [addr, value] of Object.entries(c.memory)) {
        start = pokeMemory(start, Number(addr), value);
      }
    }
    const final = run(start, check.maxSteps ?? 10_000);
    firstFinal ??= final;
    let pass = final.halted && final.error === null;
    if (c.A !== undefined) pass &&= final.A === c.A;
    if (c.cells) {
      for (const [addr, value] of Object.entries(c.cells)) {
        pass &&= final.memory[Number(addr)] === value;
      }
    }
    allPass &&= pass;
  }
  return { pass: allPass, finalState: firstFinal ?? run(createVM(bytes)) };
}

export interface DrillQuestion {
  prompt: string;
  /** For dec2bin the student toggles bits; otherwise types a number. */
  mode: "type" | "bits";
  bitCount: number;
  answer: number;
}

export function makeDrillQuestion(
  drill: "bin2dec" | "dec2bin" | "maxn",
  seed: number,
  maxValue = 15
): DrillQuestion {
  const rng = makeRng(seed);
  switch (drill) {
    case "bin2dec": {
      const v = randInt(rng, 1, maxValue);
      const bits = maxValue < 16 ? 4 : 8;
      return {
        prompt: `These lights show a number in binary: ${v
          .toString(2)
          .padStart(bits, "0")}. What number is it?`,
        mode: "type",
        bitCount: bits,
        answer: v,
      };
    }
    case "dec2bin": {
      const v = randInt(rng, 1, maxValue);
      const bits = maxValue < 16 ? 4 : 8;
      return {
        prompt: `Flip the switches to show ${v} in binary.`,
        mode: "bits",
        bitCount: bits,
        answer: v,
      };
    }
    case "maxn": {
      const n = randInt(rng, 1, 8);
      return {
        prompt: `With ${n} light${n === 1 ? "" : "s"}, what is the BIGGEST number you can show?`,
        mode: "type",
        bitCount: n,
        answer: 2 ** n - 1,
      };
    }
  }
}
