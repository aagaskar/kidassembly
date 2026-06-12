/** Initial machine setup for a lesson step. */
export interface SimSetup {
  /** Which machine to build (default bb8). */
  machine?: "bb8" | "bb16";
  /** Bytes loaded starting at address 0. */
  program?: number[];
  /** Assembly source, assembled and loaded at 0 (alternative to `program`). */
  asm?: string;
  /** Extra cells to poke after loading the program. */
  memory?: Record<number, number>;
  /** RNG seed so RANDOM-using demos replay identically. */
  seed?: number;
}

/** Parameterized micro-skill drills (§5.2 speed drills + discrimination items). */
export type DrillKind =
  | "bin2dec"
  | "dec2bin"
  | "maxn"
  | "opcode" // what does this instruction do?
  | "mlevel" // M[a] vs M[M[a]] discrimination
  | "addrvalue" // address vs value discrimination
  | "twos"; // two's complement: what do you add to get zero?

/** What a predict-state item asks about. */
export type PredictAsk =
  | { what: "A" }
  | { what: "PC" }
  | { what: "cell"; addr: number };

/** A blank in a fill-blank program. */
export interface Blank {
  blank: true;
  /** Hint shown inside the blank, e.g. "box?" */
  hint?: string;
}

/** One initial-state/expected-state pair for a fill-blank program. */
export interface TargetCase {
  /** Cells poked before the run (the randomized initial state). */
  memory?: Record<number, number>;
  /** Expected cell values after HALT. */
  cells?: Record<number, number>;
  /** Expected A after HALT. */
  A?: number;
}

/**
 * Assertions for a fill-blank program. Every case must pass — multiple
 * initial states defeat hardcoded answers (§5.2).
 */
export interface TargetCheck {
  cases: TargetCase[];
  maxSteps?: number;
}

/** One row a student fills in a loop-trace table. */
export interface TraceColumn {
  /** "A", "PC", or a memory address to watch. */
  watch: "A" | "PC" | number;
  label: string;
}

export type Step =
  | {
      kind: "info";
      text: string;
      sim?: SimSetup;
      /** Memory addresses to spotlight while the text is shown. */
      highlight?: number[];
    }
  | {
      /** Interactive switches: "make the lights show N". */
      kind: "bits";
      text: string;
      bitCount: number;
      target: number;
    }
  | {
      /** Auto-generated micro-questions (parameterized — never repeats verbatim). */
      kind: "drill";
      text: string;
      drill: DrillKind;
      count: number;
      maxValue?: number;
      /** Latency gate (automaticity skills only, §5.4): ms per question. */
      maxLatencyMs?: number;
    }
  | {
      kind: "quiz";
      text: string;
      sim?: SimSetup;
      highlight?: number[];
      choices: string[];
      answer: number;
      explain?: string;
    }
  | {
      /** Predict-state: the expected answer is computed by running the VM. */
      kind: "predict";
      text: string;
      sim: SimSetup;
      stepsToRun: number;
      ask: PredictAsk;
      explain?: string;
    }
  | {
      /** Faded example: program with blanks, graded by run-and-assert. */
      kind: "fillblank";
      text: string;
      program: (number | Blank)[];
      check: TargetCheck;
      explain?: string;
    }
  | {
      /** Parsons problem (§5.2): reorder scrambled assembly lines. */
      kind: "parsons";
      text: string;
      /** Lines in correct order (the solution). */
      lines: string[];
      /** Wrong lines mixed in that must NOT be used. */
      distractors?: string[];
      machine?: "bb8" | "bb16";
      explain?: string;
    }
  | {
      /** Loop-trace table: fill the state grid row by row (§4 Unit 5). */
      kind: "trace";
      text: string;
      sim: SimSetup;
      /** A row is sampled each time PC lands on this address. */
      watchPC: number;
      columns: TraceColumn[];
      maxRows?: number;
      maxSteps?: number;
      explain?: string;
    }
  | {
      /** Bug hunt: program + intended behavior; fix one line, run-and-assert. */
      kind: "bughunt";
      text: string;
      /** Assembly source containing exactly one bug. */
      asm: string;
      machine?: "bb8" | "bb16";
      check: TargetCheck;
      explain?: string;
    }
  | {
      /** Write-to-target: write assembly until memory/screen matches. */
      kind: "target";
      text: string;
      /** Starter source in the editor (may be empty or a skeleton). */
      starter?: string;
      machine?: "bb8" | "bb16";
      check: TargetCheck;
      explain?: string;
    }
  | {
      /** Match C lines to assembly blocks (Unit 8+). */
      kind: "match";
      text: string;
      /** Correct pairs; the UI shuffles the right-hand side. */
      pairs: { left: string; right: string }[];
      explain?: string;
    }
  | {
      /** Compiler view: C next to the assembly it becomes, stepped in sync. */
      kind: "cview";
      text: string;
      /** C source lines. */
      c: string[];
      /** Assembly source (assembled and run; comments allowed). */
      asm: string;
      machine?: "bb8" | "bb16";
      /** asm line index → C line index, for the sync highlight. */
      lineMap: Record<number, number>;
      memory?: Record<number, number>;
    }
  | {
      /** MiniC: compile real student-visible C with the Phase-4 compiler. */
      kind: "minic";
      text: string;
      source: string;
      /** "view": read + step; "edit": editable, graded by check. */
      mode: "view" | "edit";
      check?: TargetCheck;
      explain?: string;
    };

export interface Lesson {
  id: string; // "u02.first_steps"
  unit: number;
  title: string;
  summary: string;
  steps: Step[];
}

export const isBlank = (x: number | Blank): x is Blank =>
  typeof x === "object" && x !== null && "blank" in x;
