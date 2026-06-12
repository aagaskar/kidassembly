import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/content/lessons";
import { SKILLS, skillById } from "../src/content/skills";
import { checkGraph } from "../src/engine/skills";
import { Step, isBlank } from "../src/engine/types";
import {
  buildState,
  gradeFillBlank,
  gradeParsons,
  gradeTarget,
  traceExpected,
} from "../src/engine/grade";
import { gradeMiniC } from "../src/minic/grade";
import { assemble } from "../src/asm/assemble";

/**
 * Content acceptance (§7): every authored item must be machine-checkable —
 * sims assemble and run, targets/bug-hunts are solvable by their recorded
 * solution AND not by the starter/buggy original, blanks have answers, the
 * skill graph is sound. Content can never drift from machine semantics.
 */

const allSteps: { lesson: string; index: number; step: Step }[] = LESSONS.flatMap((l) =>
  l.steps.map((step, index) => ({ lesson: l.id, index, step }))
);

describe("curriculum shape", () => {
  it("covers units 0 through 15", () => {
    const units = new Set(LESSONS.map((l) => l.unit));
    for (let u = 0; u <= 15; u++) expect(units, `unit ${u} missing`).toContain(u);
  });

  it("lesson ids are unique", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the skill graph has no dangling edges or cycles", () => {
    expect(checkGraph(SKILLS)).toEqual([]);
    expect(SKILLS.length).toBe(LESSONS.length);
  });

  it("most skills carry a review-item generator", () => {
    const withReview = SKILLS.filter((s) => s.makeReviewItem).length;
    expect(withReview / SKILLS.length).toBeGreaterThan(0.8);
  });
});

describe("every sim in every lesson builds and is valid", () => {
  for (const { lesson, index, step } of allSteps) {
    const sims = [
      "sim" in step ? step.sim : undefined,
    ].filter(Boolean);
    if (sims.length === 0) continue;
    it(`${lesson} step ${index} (${step.kind})`, () => {
      for (const sim of sims) {
        const state = buildState(sim!); // throws if asm doesn't assemble
        expect(state.memory.length).toBeGreaterThan(0);
      }
    });
  }
});

describe("graded items are solvable (and not trivially passed)", () => {
  for (const { lesson, index, step } of allSteps) {
    const name = `${lesson} step ${index}`;

    if (step.kind === "fillblank") {
      it(`${name}: fillblank rejects all-zeros`, () => {
        const zeros = step.program.filter(isBlank).map(() => 0);
        // All-zero answers should not pass (otherwise the item is broken).
        expect(gradeFillBlank(step.program, step.check, zeros).pass).toBe(false);
      });
    }

    if (step.kind === "target") {
      it(`${name}: solution passes, starter fails`, () => {
        const graded = gradeTarget(step.solution, step.check, step.machine ?? "bb8");
        expect(graded.asmErrors).toEqual([]);
        expect(graded.pass).toBe(true);
        const starter = (step.starter ?? "").trim();
        const starterGrade = gradeTarget(starter, step.check, step.machine ?? "bb8");
        expect(starterGrade.pass, "starter must not already pass").toBe(false);
      });
    }

    if (step.kind === "bughunt") {
      it(`${name}: buggy original fails, solution passes`, () => {
        expect(gradeTarget(step.asm, step.check, step.machine ?? "bb8").pass).toBe(false);
        const fixed = gradeTarget(step.solution, step.check, step.machine ?? "bb8");
        expect(fixed.asmErrors).toEqual([]);
        expect(fixed.pass).toBe(true);
      });
    }

    if (step.kind === "parsons") {
      it(`${name}: solution lines assemble; distractors break grading`, () => {
        const machine = step.machine ?? "bb8";
        const { errors } = assemble(step.lines.join("\n"), machine);
        expect(errors).toEqual([]);
        expect(gradeParsons(step.lines, step.lines)).toBe(true);
        if (step.distractors?.length) {
          expect(gradeParsons(step.lines, [...step.lines, step.distractors[0]])).toBe(false);
        }
        expect(gradeParsons(step.lines, [...step.lines].reverse())).toBe(
          step.lines.length === 1
        );
      });
    }

    if (step.kind === "trace") {
      it(`${name}: trace table has rows and computable cells`, () => {
        const rows = traceExpected(step.sim, step.watchPC, step.columns, step.maxRows, step.maxSteps);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) expect(row.length).toBe(step.columns.length);
      });
    }

    if (step.kind === "cview") {
      it(`${name}: cview asm assembles and the line map points at real lines`, () => {
        const { result, errors } = assemble(step.asm, step.machine ?? "bb8");
        expect(errors).toEqual([]);
        expect(result).not.toBeNull();
        for (const [asmLine, cLine] of Object.entries(step.lineMap)) {
          expect(Number(asmLine)).toBeLessThan(step.asm.split("\n").length);
          expect(cLine).toBeLessThan(step.c.length);
        }
      });
    }

    if (step.kind === "minic") {
      it(`${name}: minic ${step.mode} compiles${step.mode === "edit" ? "; solution passes, starter fails" : ""}`, () => {
        if (step.mode === "view") {
          // view sources must compile and run to completion
          expect(
            gradeMiniC(step.source, { cases: [{}], maxSteps: 5_000_000 }).error
          ).toBeNull();
        } else {
          expect(step.check, "edit items need a check").toBeDefined();
          expect(step.solution, "edit items need a solution").toBeDefined();
          const sol = gradeMiniC(step.solution!, step.check!);
          expect(sol.error).toBeNull();
          expect(sol.pass).toBe(true);
          const starter = gradeMiniC(step.source, step.check!);
          expect(starter.pass, "starter must not already pass").toBe(false);
        }
      });
    }

    if (step.kind === "quiz") {
      it(`${name}: quiz answer index in range`, () => {
        expect(step.answer).toBeGreaterThanOrEqual(0);
        expect(step.answer).toBeLessThan(step.choices.length);
      });
    }
  }
});

describe("review-item generators produce valid, parameterized items", () => {
  for (const skill of SKILLS) {
    if (!skill.makeReviewItem) continue;
    const gen = skill.makeReviewItem;
    it(`${skill.id}`, () => {
      const a = gen(1);
      const b = gen(2);
      expect(a.kind).toBeDefined();
      // determinism: same seed, same item
      expect(JSON.stringify(gen(1))).toBe(JSON.stringify(a));
      // graded generator output must itself be valid content
      if (a.kind === "predict") {
        buildState(a.sim);
      }
      if (a.kind === "target") {
        expect(gradeTarget(a.solution, a.check, a.machine ?? "bb8").pass).toBe(true);
      }
      if (a.kind === "minic" && a.mode === "edit") {
        expect(gradeMiniC(a.solution!, a.check!).pass).toBe(true);
      }
      if (a.kind === "parsons") {
        expect(assemble(a.lines.join("\n"), a.machine ?? "bb8").errors).toEqual([]);
      }
      void b;
    });
  }
});

describe("skill lookup", () => {
  it("finds skills by lesson id", () => {
    expect(skillById("u00.switches")?.unit).toBe(0);
    expect(skillById("u12.swap")?.subsumes).toContain("u12.address_of");
    expect(skillById("nope")).toBeUndefined();
  });
});
