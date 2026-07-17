import { Skill } from "../engine/skills";
import { DrillKind, OpcodeDrillOp, Step } from "../engine/types";
import { makeRng, randInt } from "../engine/rng";
import { Op } from "../vm/types";
import { LESSONS } from "./lessons";

/**
 * The knowledge graph (§5.4): one skill per lesson, prerequisite-chained in
 * curriculum order, with `subsumes` edges for layering credit. Each skill's
 * review item is a parameterized generator (§5.3) — reviews never repeat
 * verbatim.
 */

type Gen = (seed: number) => Step;

const drill = (kind: DrillKind, count = 3, ops?: OpcodeDrillOp[]): Gen => () => ({
  kind: "drill",
  text: "Review!",
  drill: kind,
  count,
  ...(ops ? { ops } : {}),
});

/** Predict A after a tiny randomized straight-line program. */
const predictArith: Gen = (seed) => {
  const rng = makeRng(seed);
  const a = randInt(rng, 2, 60);
  const addr = randInt(rng, 20, 40);
  const v = randInt(rng, 2, 50);
  const sub = randInt(rng, 0, 1) === 1;
  return {
    kind: "predict",
    text: `Review: box ${addr} holds ${v}. The program runs LOADC ${a}, then ${sub ? "SUB" : "ADD"} ${addr}. Predict A.`,
    sim: { program: [Op.LOADC, a, sub ? Op.SUB : Op.ADD, addr, Op.HALT, 0], memory: { [addr]: v } },
    stepsToRun: 2,
    ask: { what: "A" },
  };
};

/** Predict a memory cell after LOADC/STORE. */
const predictStore: Gen = (seed) => {
  const rng = makeRng(seed);
  const v = randInt(rng, 1, 99);
  const addr = randInt(rng, 50, 110);
  return {
    kind: "predict",
    text: `Review: LOADC ${v}, then STORE ${addr}. Predict what's in box ${addr} after.`,
    sim: { program: [Op.LOADC, v, Op.STORE, addr, Op.HALT, 0] },
    stepsToRun: 2,
    ask: { what: "cell", addr },
  };
};

/** Predict the screen cell painted through a pointer. */
const predictStorep: Gen = (seed) => {
  const rng = makeRng(seed);
  const color = randInt(rng, 1, 15);
  const ptrBox = randInt(rng, 20, 40);
  const target = randInt(rng, 128, 191);
  return {
    kind: "predict",
    text: `Review: box ${ptrBox} holds ${target}. LOADC ${color}, then STOREP ${ptrBox}. Predict what's in box ${target}.`,
    sim: { program: [Op.LOADC, color, Op.STOREP, ptrBox, Op.HALT, 0], memory: { [ptrBox]: target } },
    stepsToRun: 2,
    ask: { what: "cell", addr: target },
  };
};

/** JZ prediction: does the jump fire? Scoped to exactly what u05.jz taught. */
const predictJz: Gen = (seed) => {
  const rng = makeRng(seed);
  const fires = randInt(rng, 0, 1) === 1;
  const v = fires ? 0 : randInt(rng, 1, 99);
  return {
    kind: "predict",
    text: `Review: A is loaded with ${v}, then JZ 8 runs. Predict PC after both steps. (Box 8 has a HALT. If JZ doesn't jump, the machine just continues to the next instruction.)`,
    sim: { program: [Op.LOADC, v, Op.JZ, 8, Op.LOADC, 99, Op.HALT, 0, Op.HALT, 0] },
    stepsToRun: 2,
    ask: { what: "PC" },
  };
};

/** Countdown-loop trace cell: how many laps? */
const predictLoop: Gen = (seed) => {
  const rng = makeRng(seed);
  const n = randInt(rng, 2, 5);
  return {
    kind: "predict",
    text: `Review: a countdown — PLUSONE box 20, MINUSONE box 21 (which holds ${n}), JZ to the end, JUMP back. After it halts, what's in box 20?`,
    sim: {
      asm: `loop: PLUSONE 20\nMINUSONE 21\nJZ done\nJUMP loop\ndone: HALT`,
      memory: { 21: n },
    },
    stepsToRun: 60,
    ask: { what: "cell", addr: 20 },
  };
};

/** Parsons review: rebuild the countdown loop with randomized count. */
const parsonsLoop: Gen = (seed) => {
  const rng = makeRng(seed);
  const n = randInt(rng, 3, 9);
  return {
    kind: "parsons",
    text: `Review: build the loop that PLUSONEs "score" exactly ${n} times.`,
    lines: [
      "loop: PLUSONE score",
      "MINUSONE count",
      "JZ done",
      "JUMP loop",
      "done: HALT",
      "score: .byte 0",
      `count: .byte ${n}`,
    ],
  };
};

/** Write-to-target review: paint a randomized pixel. */
const targetPixel: Gen = (seed) => {
  const rng = makeRng(seed);
  const color = randInt(rng, 1, 15);
  const addr = randInt(rng, 128, 191);
  return {
    kind: "target",
    text: `Review: write a program that puts color ${color} in box ${addr}, then halts.`,
    check: { cases: [{ cells: { [addr]: color } }] },
    solution: `LOADC ${color}\nSTORE ${addr}\nHALT`,
  };
};

/** CALL/RET prediction with randomized routine address. */
const predictCall: Gen = (seed) => {
  const rng = makeRng(seed);
  const target = 2 * randInt(rng, 4, 8);
  const program = Array(target + 1).fill(0);
  program[0] = Op.CALL;
  program[1] = target;
  program[2] = Op.HALT;
  program[target] = Op.RET;
  return {
    kind: "predict",
    text: `Review: CALL ${target} runs from box 0. CALL leaves a breadcrumb — predict what's in box 255 after one step.`,
    sim: { program },
    stepsToRun: 1,
    ask: { what: "cell", addr: 255 },
  };
};

/** Match review for the C bridge. */
const matchBridge: Gen = (seed) => {
  const rng = makeRng(seed);
  const x = randInt(rng, 2, 9);
  return {
    kind: "match",
    text: "Review: match the shorthand to the assembly.",
    pairs: [
      { left: `x = ${x};`, right: `LOADC ${x} / STORE x` },
      { left: "x = x + 1;", right: "LOAD x / ADD one / STORE x" },
      { left: "x = y;", right: "LOAD y / STORE x" },
    ],
  };
};

/** MiniC review: a tiny edit task with randomized constant. */
const minicAssign = (template: (n: number) => { text: string; source: string; answer: number; solution: string }): Gen =>
  (seed) => {
    const rng = makeRng(seed);
    const n = randInt(rng, 3, 12);
    const t = template(n);
    return {
      kind: "minic",
      text: t.text,
      source: t.source,
      mode: "edit",
      check: { cases: [{ A: t.answer }] },
      solution: t.solution,
    };
  };

/** Scoped to u09.variables: assignment + arithmetic only — loops are Unit 10. */
const minicVarReview: Gen = (seed) => {
  const rng = makeRng(seed);
  const n = randInt(rng, 3, 12);
  return {
    kind: "minic",
    text: `Review: make the variable x hold ${n} times 7 (in C, times is written *), then return x.`,
    source: `int x;\n\nint main() {\n  // set x, then return it\n  return 0;\n}`,
    mode: "edit",
    check: { cases: [{ A: n * 7, expectSymbols: { x: n * 7 } }] },
    solution: `int x;\n\nint main() {\n  x = ${n} * 7;\n  return x;\n}`,
  };
};

/** Scoped to u09.assignment: = copies right into left — no pointers (Unit 12). */
const minicCopyReview: Gen = (seed) => {
  const rng = makeRng(seed);
  const v1 = randInt(rng, 10, 40);
  const v2 = randInt(rng, 41, 90);
  return {
    kind: "minic",
    text: "Review: copy y into x with =, then return x. (It must work whatever y holds — the tests change it!)",
    source: `int x;\nint y;\n\nint main() {\n  // copy, then return x\n  return 0;\n}`,
    mode: "edit",
    check: {
      cases: [
        { symbols: { y: v1 }, A: v1, expectSymbols: { x: v1 } },
        { symbols: { y: v2 }, A: v2, expectSymbols: { x: v2 } },
      ],
    },
    solution: `int x;\nint y;\n\nint main() {\n  x = y;\n  return x;\n}`,
  };
};

/** Scoped to u10.if: an if and a comparison — while/for come in later lessons. */
const minicMaxReview: Gen = (seed) => {
  const rng = makeRng(seed);
  // Two cases with DIFFERENT winners on different sides, so neither a
  // hardcoded constant nor "always return a" can pass.
  const lo1 = randInt(rng, 1, 40);
  const hi1 = randInt(rng, 41, 65);
  const lo2 = randInt(rng, 1, 40);
  const hi2 = randInt(rng, 66, 90);
  return {
    kind: "minic",
    text: "Review: return the LARGER of a and b. (The tests try several pairs — no hardcoding!)",
    source: `int a;\nint b;\n\nint main() {\n  // return the larger one\n  return 0;\n}`,
    mode: "edit",
    check: {
      cases: [
        { symbols: { a: hi1, b: lo1 }, A: hi1 },
        { symbols: { a: lo2, b: hi2 }, A: hi2 },
      ],
    },
    solution: `int a;\nint b;\n\nint main() {\n  if (a > b) {\n    return a;\n  }\n  return b;\n}`,
  };
};

const minicLoopReview = minicAssign((n) => ({
  text: `Review: make main return the sum 1 + 2 + … + ${n} using a loop.`,
  source: `int main() {\n  // loop here\n  return 0;\n}`,
  answer: (n * (n + 1)) / 2,
  solution: `int main() {\n  int s = 0;\n  for (int i = 1; i <= ${n}; i = i + 1) { s = s + i; }\n  return s;\n}`,
}));

const minicFnReview = minicAssign((n) => ({
  text: `Review: write times3(x) (returns x times 3) and make main return times3(${n}).`,
  source: `int main() {\n  return 0;\n}`,
  answer: n * 3,
  solution: `int times3(int x) { return x * 3; }\nint main() { return times3(${n}); }`,
}));

const minicPtrReview = minicAssign((n) => ({
  text: `Review: use a pointer — set g to ${n} THROUGH p (no "g =" allowed), return g.`,
  source: `int g;\nint* p;\n\nint main() {\n  p = &g;\n  // set *p\n  return g;\n}`,
  answer: n,
  solution: `int g;\nint* p;\n\nint main() {\n  p = &g;\n  *p = ${n};\n  return g;\n}`,
}));

const minicArrReview = minicAssign((n) => ({
  text: `Review: fill a[i] = i * ${n} for i in 0..4 with a loop; return a[4].`,
  source: `int a[5];\n\nint main() {\n  // loop\n  return a[4];\n}`,
  answer: 4 * n,
  solution: `int a[5];\n\nint main() {\n  for (int i = 0; i < 5; i = i + 1) { a[i] = i * ${n}; }\n  return a[4];\n}`,
}));

// Same task in star form for Unit 12 — a[i] bracket indexing arrives in Unit 13.
const minicPtrArrReview = minicAssign((n) => ({
  text: `Review: fill 5 slots with a loop — make *(a + i) hold i * ${n} for i in 0..4; return *(a + 4).`,
  source: `int a[5];\n\nint main() {\n  // loop\n  return *(a + 4);\n}`,
  answer: 4 * n,
  solution: `int a[5];\n\nint main() {\n  for (int i = 0; i < 5; i = i + 1) { *(a + i) = i * ${n}; }\n  return *(a + 4);\n}`,
}));

// ---------------------------------------------------------------- graph

interface SkillSpec {
  subsumes?: string[];
  automaticity?: boolean;
  review?: Gen;
}

/** Per-lesson tuning; lessons not listed get defaults (chain prereq, no review). */
const SPECS: Record<string, SkillSpec> = {
  "u00.switches": { review: drill("dec2bin", 2) },
  "u00.counting": { automaticity: true, review: drill("bin2dec", 3) },
  "u00.bytes": { automaticity: true, review: drill("maxn", 2) },
  "u00.three_faces": { review: drill("bin2dec", 2) },
  "u01.boxes": { automaticity: true, review: drill("addrvalue", 3) },
  // trail, not mlevel: mlevel prompts say LOAD/LOADP, and no instruction
  // exists until Unit 2 (LOADP not until Unit 6).
  "u01.treasure": { review: drill("trail", 3) },
  // Opcode reviews are scoped to instructions taught by that point — a
  // scheduled review must never quiz an instruction the child hasn't met.
  "u02.wakes": { review: drill("opcode", 2, ["LOADC"]) },
  "u02.load": { automaticity: true, subsumes: ["u01.boxes"], review: drill("opcode", 3, ["LOADC", "LOAD"]) },
  "u02.store": { subsumes: ["u02.load"], review: predictStore },
  "u02.program_in_boxes": { review: drill("opcode", 2, ["LOADC", "LOAD", "STORE"]) },
  "u03.add": { subsumes: ["u02.store"], review: predictArith },
  "u03.machine_code": { review: predictArith },
  "u03.first_pixel": { subsumes: ["u02.store"], review: predictStore },
  "u03.wraparound": { review: drill("twos", 2) },
  "u04.mnemonics": { subsumes: ["u03.machine_code"], review: targetPixel },
  "u04.labels": { review: targetPixel },
  "u04.variables": { subsumes: ["u04.labels"], review: drill("addrvalue", 2) },
  "u05.jump": { review: drill("opcode", 2) },
  // predictJz, not predictLoop: the countdown idiom (MINUSONE/PLUSONE) isn't
  // taught until u05.countdown, two lessons later.
  "u05.jz": { review: predictJz },
  "u05.twos": { automaticity: true, review: drill("twos", 3) },
  "u05.countdown": { subsumes: ["u05.jump", "u05.jz"], review: predictLoop },
  "u05.loop_bugs": { subsumes: ["u05.countdown"], review: parsonsLoop },
  "u06.arrows": { automaticity: true, subsumes: ["u01.treasure"], review: drill("mlevel", 3) },
  "u06.storep": { subsumes: ["u06.arrows"], review: predictStorep },
  "u06.pointer_word": { review: drill("mlevel", 2) },
  "u06.walk": { subsumes: ["u06.storep", "u05.countdown"], review: predictStorep },
  "u06.copy": { subsumes: ["u06.walk"], review: parsonsLoop },
  "u07.call": { review: predictCall },
  "u07.pushpop": { review: predictCall },
  "u07.routine": { subsumes: ["u07.call", "u07.pushpop"], review: predictCall },
  "u07.overflow": {},
  "u08.shorthand": { review: matchBridge },
  "u08.cview": { subsumes: ["u08.shorthand"], review: matchBridge },
  "u08.cview_loop": { subsumes: ["u08.cview", "u05.countdown"], review: matchBridge },
  "u09.bitbot16": {},
  // Unit 9/10 reviews stay within their unit's constructs: loops arrive in
  // Unit 10 (after u10.if) and C pointer syntax in Unit 12.
  "u09.variables": { review: minicVarReview },
  "u09.types": { review: drill("maxn", 2) },
  "u09.assignment": { subsumes: ["u02.store"], review: minicCopyReview },
  "u10.if": { review: minicMaxReview },
  "u10.while": { subsumes: ["u05.countdown", "u08.cview_loop"], review: minicLoopReview },
  "u10.for": { subsumes: ["u10.while"], review: minicLoopReview },
  "u11.functions": { subsumes: ["u07.routine"], review: minicFnReview },
  "u11.scope": {},
  "u11.recursion": { subsumes: ["u11.functions", "u07.call"], review: minicFnReview },
  "u12.address_of": { subsumes: ["u06.pointer_word"], review: minicPtrReview },
  "u12.swap": { subsumes: ["u12.address_of", "u11.functions"], review: minicPtrReview },
  // Star form (*(a + i)) here: bracket indexing is taught in u13.arrays.
  "u12.pointer_math": { subsumes: ["u12.address_of"], review: minicPtrArrReview },
  "u12.screen": { subsumes: ["u12.pointer_math", "u06.walk"], review: minicPtrArrReview },
  "u13.arrays": { subsumes: ["u12.pointer_math"], review: minicArrReview },
  "u13.strings": { subsumes: ["u13.arrays", "u10.while"], review: minicArrReview },
  "u13.overrun": {},
  "u14.structs": { review: minicFnReview },
  "u14.sprites": { subsumes: ["u14.structs", "u13.arrays", "u12.screen"], review: minicArrReview },
  "u15.game_loop": { subsumes: ["u14.sprites", "u10.for"], review: minicLoopReview },
  "u15.travel_guide": {},
};

export const SKILLS: Skill[] = LESSONS.map((lesson, i) => {
  const spec = SPECS[lesson.id] ?? {};
  return {
    id: lesson.id,
    unit: lesson.unit,
    title: lesson.title,
    // Curriculum-order chain: each lesson gates on the one before it.
    prereqs: i > 0 ? [LESSONS[i - 1].id] : [],
    subsumes: spec.subsumes ?? [],
    automaticity: spec.automaticity ?? false,
    relearnRule: 2,
    makeReviewItem: spec.review,
  };
});

const byId = new Map(SKILLS.map((s) => [s.id, s]));

export function skillById(id: string): Skill | undefined {
  return byId.get(id);
}
