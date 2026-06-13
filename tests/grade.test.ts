import { describe, expect, it } from "vitest";
import { Op } from "../src/vm/types";
import {
  expectedPrediction,
  gradeFillBlank,
  gradePredict,
  makeDrillQuestion,
} from "../src/engine/grade";
import { LESSONS } from "../src/content/lessons";
import { programToText, textToProgram } from "../src/files/programText";

describe("predict-state grading", () => {
  const sim = { program: [Op.LOADC, 9, Op.STORE, 20, Op.HALT, 0] };

  it("computes the expected answer from the VM itself", () => {
    expect(expectedPrediction(sim, 1, { what: "A" })).toBe(9);
    expect(expectedPrediction(sim, 1, { what: "PC" })).toBe(2);
    expect(expectedPrediction(sim, 2, { what: "cell", addr: 20 })).toBe(9);
  });

  it("grades exact match", () => {
    expect(gradePredict(sim, 1, { what: "A" }, 9)).toBe(true);
    expect(gradePredict(sim, 1, { what: "A" }, 8)).toBe(false);
  });
});

describe("fill-blank grading (run-and-assert)", () => {
  const B = { blank: true as const };
  const copyProgram = [Op.LOAD, B, Op.STORE, B, Op.HALT, 0];
  const copyCheck = {
    cases: [
      { memory: { 20: 77 }, cells: { 21: 77 } },
      { memory: { 20: 5 }, cells: { 21: 5 } },
    ],
    maxSteps: 10,
  };

  it("the reference solution passes", () => {
    expect(gradeFillBlank(copyProgram, copyCheck, [20, 21]).pass).toBe(true);
  });

  it("wrong answers fail", () => {
    expect(gradeFillBlank(copyProgram, copyCheck, [21, 20]).pass).toBe(false);
    expect(gradeFillBlank(copyProgram, copyCheck, [20, 22]).pass).toBe(false);
  });

  it("multiple randomized cases defeat hardcoding", () => {
    // A program shaped LOADC ? / STORE ? can hardcode ONE case but not both.
    const hardcodable = [Op.LOADC, B, Op.STORE, B, Op.HALT, 0];
    const result = gradeFillBlank(hardcodable, copyCheck, [77, 21]);
    expect(result.pass).toBe(false); // passes case 1, fails case 2
  });

  it("a program that never halts fails", () => {
    const looping = [Op.JUMP, B, Op.HALT, 0];
    expect(gradeFillBlank(looping, { cases: [{}], maxSteps: 100 }, [0]).pass).toBe(false);
  });

  it("every fill-blank item in shipped content has a passing reference solution", () => {
    // u02.store item 1: put 99 into box 30 → blanks [99, 30]
    // u02.store item 2: copy box 20 to 21 → blanks [20, 21]
    const reference: Record<string, number[][]> = {
      "u02.store": [
        [99, 30],
        [20, 21],
      ],
      "u03.add": [[25, 20]],
      "u03.machine_code": [
        [2, 3], // LOAD=2, STORE=3
        [50, 50, 51], // LOAD 50 / ADD 50 / STORE 51
      ],
      "u03.first_pixel": [
        [2, 136],
        [128, 135],
      ],
    };
    for (const lesson of LESSONS) {
      const fillblanks = lesson.steps.filter((s) => s.kind === "fillblank");
      if (fillblanks.length === 0) continue;
      const solutions = reference[lesson.id];
      expect(solutions, `missing reference solutions for ${lesson.id}`).toBeDefined();
      fillblanks.forEach((stepDef, i) => {
        if (stepDef.kind !== "fillblank") return;
        const { pass } = gradeFillBlank(stepDef.program, stepDef.check, solutions[i]);
        expect(pass, `${lesson.id} fillblank #${i} reference solution must pass`).toBe(true);
      });
    }
  });
});

describe("drill generation (parameterized items, §5.3)", () => {
  it("is deterministic for a given seed", () => {
    const a = makeDrillQuestion("bin2dec", 42);
    const b = makeDrillQuestion("bin2dec", 42);
    expect(a).toEqual(b);
  });

  it("varies across seeds", () => {
    const answers = new Set(
      Array.from({ length: 50 }, (_, i) => makeDrillQuestion("bin2dec", i + 1).answer)
    );
    expect(answers.size).toBeGreaterThan(3);
  });

  it("answers are always within range", () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(makeDrillQuestion("bin2dec", seed).answer).toBeLessThanOrEqual(15);
      expect(makeDrillQuestion("bin2dec", seed).answer).toBeGreaterThanOrEqual(1);
      const maxn = makeDrillQuestion("maxn", seed);
      expect(maxn.answer).toBe(2 ** maxn.bitCount - 1);
    }
  });
});

describe("program text format", () => {
  it("round-trips bytes through text", () => {
    const prog = [Op.LOADC, 9, Op.STORE, 130, Op.HALT, 0];
    expect(textToProgram(programToText(prog))).toEqual(prog);
  });

  it("ignores comments and rejects junk", () => {
    expect(textToProgram("; hello\n1 9 ; LOADC 9\n0 0\n")).toEqual([1, 9, 0, 0]);
    expect(() => textToProgram("1 banana")).toThrow(/banana/);
    expect(() => textToProgram("999 0")).toThrow();
  });

  it("predict answers in shipped lessons are derivable (content sanity)", () => {
    for (const lesson of LESSONS) {
      for (const stepDef of lesson.steps) {
        if (stepDef.kind !== "predict") continue;
        const expected = expectedPrediction(stepDef.sim, stepDef.stepsToRun, stepDef.ask);
        expect(expected, `${lesson.id}: prediction must be a byte`).toBeGreaterThanOrEqual(0);
        expect(expected).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("scaffolding fade policy", () => {
  it("starts full, fades after success, hides after repeated success, and restores after mistakes", async () => {
    const { currentScaffoldLevel, resolveScaffoldLevel, updateScaffoldAfterAttempt } = await import("../src/engine/scaffolding");
    const id = "binary.placeValues";
    let state = {};

    expect(currentScaffoldLevel(state, id)).toBe("full");
    state = updateScaffoldAfterAttempt(state, id, true);
    expect(currentScaffoldLevel(state, id)).toBe("faded");
    state = updateScaffoldAfterAttempt(state, id, true);
    expect(currentScaffoldLevel(state, id)).toBe("hidden");
    state = updateScaffoldAfterAttempt(state, id, false);
    expect(currentScaffoldLevel(state, id)).toBe("full");
    expect(resolveScaffoldLevel(state, id, "hidden")).toBe("hidden");
    expect(resolveScaffoldLevel(state, id, "auto")).toBe("full");
  });

  it("tags binary drill questions with the reusable binary scaffold", () => {
    expect(makeDrillQuestion("bin2dec", 1).scaffoldId).toBe("binary.placeValues");
    expect(makeDrillQuestion("dec2bin", 1).scaffoldId).toBe("binary.placeValues");
    expect(makeDrillQuestion("opcode", 1).scaffoldId).toBeUndefined();
  });
});
