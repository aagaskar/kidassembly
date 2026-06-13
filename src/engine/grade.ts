import { Blank, isBlank, PredictAsk, SimSetup, TargetCase, TargetCheck, TraceColumn } from "./types";
import { MachineKind, VMState } from "../vm/types";
import { createVM, pokeMemory, run, step } from "../vm/vm";
import { assemble } from "../asm/assemble";
import { makeRng, randInt } from "./rng";

export function buildState(sim: SimSetup): VMState {
  const machine = sim.machine ?? "bb8";
  let program = sim.program ?? [];
  if (sim.asm !== undefined) {
    const { result, errors } = assemble(sim.asm, machine);
    if (!result) {
      // Authoring bug, not a student error — fail loudly in dev/tests.
      throw new Error(`lesson asm does not assemble: ${errors[0]?.message}`);
    }
    program = result.bytes;
  }
  let s = createVM(program, sim.seed ?? 1, machine);
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

// ------------------------------------------------------- run-and-assert

function runCase(bytes: number[], c: TargetCase, machine: MachineKind, maxSteps: number): {
  pass: boolean;
  finalState: VMState;
} {
  let start = createVM(bytes, 1, machine);
  if (c.memory) {
    for (const [addr, value] of Object.entries(c.memory)) {
      start = pokeMemory(start, Number(addr), value);
    }
  }
  const final = run(start, maxSteps);
  let pass = final.halted && final.error === null;
  if (c.A !== undefined) pass &&= final.A === c.A;
  if (c.cells) {
    for (const [addr, value] of Object.entries(c.cells)) {
      pass &&= final.memory[Number(addr)] === value;
    }
  }
  return { pass, finalState: final };
}

export interface TargetGrade {
  pass: boolean;
  /** Assembler errors, if the source didn't assemble. */
  asmErrors: { line: number; message: string }[];
  /** Final state of the first failing case (or first case if all pass). */
  finalState: VMState | null;
  failedCase: number | null;
}

/**
 * Write-to-target / bug-hunt grader (§5.2): assemble the student's source,
 * run it against every randomized initial state, assert the final state.
 */
export function gradeTarget(
  source: string,
  check: TargetCheck,
  machine: MachineKind = "bb8"
): TargetGrade {
  const { result, errors } = assemble(source, machine);
  if (!result) return { pass: false, asmErrors: errors, finalState: null, failedCase: null };
  let firstFinal: VMState | null = null;
  for (let i = 0; i < check.cases.length; i++) {
    const r = runCase(result.bytes, check.cases[i], machine, check.maxSteps ?? 100_000);
    firstFinal ??= r.finalState;
    if (!r.pass) {
      return { pass: false, asmErrors: [], finalState: r.finalState, failedCase: i };
    }
  }
  return { pass: true, asmErrors: [], finalState: firstFinal, failedCase: null };
}

/**
 * Parsons grader: order must match, distractors must be left out.
 * Lines are compared with whitespace collapsed.
 */
export function gradeParsons(solutionLines: string[], studentLines: string[]): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  if (studentLines.length !== solutionLines.length) return false;
  return solutionLines.every((line, i) => norm(line) === norm(studentLines[i]));
}

/** Expected rows of a loop-trace table: sampled each time PC hits watchPC. */
export function traceExpected(
  sim: SimSetup,
  watchPC: number,
  columns: TraceColumn[],
  maxRows = 6,
  maxSteps = 10_000
): number[][] {
  let s = buildState(sim);
  const rows: number[][] = [];
  const sample = (st: VMState) =>
    columns.map((c) => (c.watch === "A" ? st.A : c.watch === "PC" ? st.PC : st.memory[c.watch]));
  for (let i = 0; i < maxSteps && rows.length < maxRows && !s.halted; i++) {
    if (s.PC === watchPC) rows.push(sample(s));
    s = step(s);
  }
  return rows;
}

export interface DrillQuestion {
  prompt: string;
  /** Toggle bits, type a number, or pick from choices. */
  mode: "type" | "bits" | "choice";
  bitCount: number;
  answer: number;
  /** Identifier for a reusable scaffold that can be faded as mastery improves. */
  scaffoldId?: string;
  /** Binary digits shown in the prompt, when a place-value scaffold can help. */
  binary?: string;
  /** For mode "choice": the answer is an index into these. */
  choices?: string[];
}

export function makeDrillQuestion(
  drill: import("./types").DrillKind,
  seed: number,
  maxValue = 15
): DrillQuestion {
  const rng = makeRng(seed);
  switch (drill) {
    case "opcode": {
      // "After this instruction runs, what is in A?" — semantics drill.
      const a = randInt(rng, 1, 9);
      const boxAddr = randInt(rng, 20, 30);
      const boxVal = randInt(rng, 1, 9);
      const kind = randInt(rng, 0, 3);
      const prompts = [
        {
          q: `A holds ${a}. Box ${boxAddr} holds ${boxVal}. The machine runs LOADC ${boxAddr}. What is in A now?`,
          ans: boxAddr,
        },
        {
          q: `A holds ${a}. Box ${boxAddr} holds ${boxVal}. The machine runs LOAD ${boxAddr}. What is in A now?`,
          ans: boxVal,
        },
        {
          q: `A holds ${a}. Box ${boxAddr} holds ${boxVal}. The machine runs ADD ${boxAddr}. What is in A now?`,
          ans: a + boxVal,
        },
        {
          q: `A holds ${a}. Box ${boxAddr} holds ${boxVal}. The machine runs STORE ${boxAddr}. What is in box ${boxAddr} now?`,
          ans: a,
        },
      ];
      return { prompt: prompts[kind].q, mode: "type", bitCount: 0, answer: prompts[kind].ans };
    }
    case "mlevel": {
      // M[a] vs M[M[a]]: the dereference discrimination drill (§10).
      const a = randInt(rng, 10, 19);
      const mid = randInt(rng, 30, 39);
      const deep = randInt(rng, 1, 9);
      const direct = randInt(rng, 0, 1) === 0;
      return direct
        ? {
            prompt: `Box ${a} holds ${mid}. Box ${mid} holds ${deep}. LOAD ${a} — what lands in A?`,
            mode: "type",
            bitCount: 0,
            answer: mid,
          }
        : {
            prompt: `Box ${a} holds ${mid}. Box ${mid} holds ${deep}. LOADP ${a} (follow the arrow) — what lands in A?`,
            mode: "type",
            bitCount: 0,
            answer: deep,
          };
    }
    case "addrvalue": {
      const addr = randInt(rng, 5, 60);
      const val = randInt(rng, 61, 99);
      const askAddr = randInt(rng, 0, 1) === 0;
      return askAddr
        ? {
            prompt: `Box ${addr} holds ${val}. What is the ADDRESS of that box?`,
            mode: "type",
            bitCount: 0,
            answer: addr,
          }
        : {
            prompt: `Box ${addr} holds ${val}. What is IN the box?`,
            mode: "type",
            bitCount: 0,
            answer: val,
          };
    }
    case "twos": {
      // "What do you add to get zero?" — two's complement as wraparound.
      const v = randInt(rng, 1, 9);
      return {
        prompt: `A byte holds ${v}. What number do you ADD so it wraps around to exactly 0? (Bytes wrap at 256.)`,
        mode: "type",
        bitCount: 0,
        answer: 256 - v,
      };
    }
    case "bin2dec": {
      const v = randInt(rng, 1, maxValue);
      const bits = maxValue < 16 ? 4 : 8;
      return {
        prompt: `These lights show a number in binary: ${v
          .toString(2)
          .padStart(bits, "0")}. Use the place values to add the ON switches. What number is it?`,
        mode: "type",
        bitCount: bits,
        answer: v,
        scaffoldId: "binary.placeValues",
        binary: v.toString(2).padStart(bits, "0"),
      };
    }
    case "dec2bin": {
      const v = randInt(rng, 1, maxValue);
      const bits = maxValue < 16 ? 4 : 8;
      return {
        prompt: `Flip the switches to show ${v} in binary. Use the place values; 1 is ON and 0 is OFF.`,
        mode: "bits",
        bitCount: bits,
        answer: v,
        scaffoldId: "binary.placeValues",
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
