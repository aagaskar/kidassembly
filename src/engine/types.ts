/** Initial machine setup for a lesson step. */
export interface SimSetup {
  /** Bytes loaded starting at address 0. */
  program?: number[];
  /** Extra cells to poke after loading the program. */
  memory?: Record<number, number>;
  /** RNG seed so RANDOM-using demos replay identically. */
  seed?: number;
}

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
      drill: "bin2dec" | "dec2bin" | "maxn";
      count: number;
      maxValue?: number;
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
