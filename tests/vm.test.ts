import { describe, expect, it } from "vitest";
import { Op } from "../src/vm/types";
import { createVM, pokeMemory, run, step } from "../src/vm/vm";

/** Golden-trace helper: step through a program asserting state after each step. */
function trace(
  program: number[],
  pokes: Record<number, number>,
  expected: Array<Partial<{ A: number; PC: number; SP: number; halted: boolean; mem: Record<number, number> }>>
) {
  let s = createVM(program);
  for (const [addr, value] of Object.entries(pokes)) {
    s = pokeMemory(s, Number(addr), value);
  }
  for (const exp of expected) {
    s = step(s);
    if (exp.A !== undefined) expect(s.A).toBe(exp.A);
    if (exp.PC !== undefined) expect(s.PC).toBe(exp.PC);
    if (exp.SP !== undefined) expect(s.SP).toBe(exp.SP);
    if (exp.halted !== undefined) expect(s.halted).toBe(exp.halted);
    if (exp.mem) {
      for (const [addr, value] of Object.entries(exp.mem)) {
        expect(s.memory[Number(addr)]).toBe(value);
      }
    }
  }
  return s;
}

describe("BitBot-8 golden traces", () => {
  it("LOADC / STORE / LOAD / HALT", () => {
    trace(
      [Op.LOADC, 9, Op.STORE, 40, Op.LOAD, 41, Op.HALT, 0],
      { 41: 5 },
      [
        { A: 9, PC: 2 },
        { PC: 4, mem: { 40: 9 } },
        { A: 5, PC: 6 },
        { halted: true, A: 5, PC: 6 },
      ]
    );
  });

  it("ADD wraps mod 256", () => {
    trace([Op.LOADC, 250, Op.ADD, 20, Op.HALT, 0], { 20: 10 }, [
      { A: 250 },
      { A: 4, PC: 4 }, // 260 mod 256
      { halted: true },
    ]);
  });

  it("SUB wraps below zero (two's complement view)", () => {
    trace([Op.LOADC, 5, Op.SUB, 20, Op.HALT, 0], { 20: 10 }, [
      { A: 5 },
      { A: 251, PC: 4 }, // 5 − 10 = −5 ≡ 251
    ]);
  });

  it("countdown loop with MINUSONE / JZ / JUMP", () => {
    const prog = [
      Op.LOADC, 3,     // 0
      Op.STORE, 40,    // 2
      Op.MINUSONE, 40, // 4: loop body
      Op.JZ, 10,       // 6
      Op.JUMP, 4,      // 8
      Op.HALT, 0,      // 10
    ];
    const final = run(createVM(prog));
    expect(final.halted).toBe(true);
    expect(final.memory[40]).toBe(0);
    expect(final.A).toBe(0);
    // 2 setup steps + 3 iterations × (MINUSONE + JZ) + 2 taken JUMPs + HALT
    expect(final.steps).toBe(2 + 6 + 2 + 1);
  });

  it("JZ falls through when A ≠ 0", () => {
    trace([Op.LOADC, 1, Op.JZ, 10, Op.HALT, 0], {}, [
      { A: 1, PC: 2 },
      { PC: 4 }, // not taken
      { halted: true },
    ]);
  });

  it("JNEG jumps when the top bit is set", () => {
    const prog = [
      Op.LOADC, 0,  // 0
      Op.SUB, 20,   // 2: 0 − 1 = 255 (negative)
      Op.JNEG, 8,   // 4
      Op.HALT, 0,   // 6: skipped
      Op.LOADC, 77, // 8
      Op.HALT, 0,   // 10
    ];
    trace(prog, { 20: 1 }, [
      { A: 0 },
      { A: 255 },
      { PC: 8 },
      { A: 77 },
      { halted: true },
    ]);
  });

  it("LOADP follows the arrow (A ← M[M[a]])", () => {
    trace([Op.LOADP, 10, Op.HALT, 0], { 10: 60, 60: 42 }, [{ A: 42, PC: 2 }]);
  });

  it("STOREP writes through the arrow (M[M[a]] ← A)", () => {
    trace([Op.LOADC, 7, Op.STOREP, 10, Op.HALT, 0], { 10: 60 }, [
      { A: 7 },
      { PC: 4, mem: { 60: 7, 10: 60 } },
    ]);
  });

  it("CALL/RET/PUSH/POP and the downward stack", () => {
    const prog = [
      Op.LOADC, 5,  // 0
      Op.CALL, 8,   // 2: pushes return address 4
      Op.STORE, 40, // 4: after return
      Op.HALT, 0,   // 6
      Op.PUSH, 0,   // 8: save A
      Op.LOADC, 9,  // 10: clobber A
      Op.POP, 0,    // 12: restore A
      Op.RET, 0,    // 14
    ];
    trace(prog, {}, [
      { A: 5, PC: 2 },
      { PC: 8, SP: 254, mem: { 255: 4 } }, // CALL
      { PC: 10, SP: 253, mem: { 254: 5 } }, // PUSH
      { A: 9, PC: 12 },
      { A: 5, PC: 14, SP: 254 }, // POP
      { PC: 4, SP: 255 }, // RET
      { PC: 6, mem: { 40: 5 } },
      { halted: true },
    ]);
  });

  it("PLUSONE wraps 255 → 0 and lands the new value in A", () => {
    trace([Op.PLUSONE, 20, Op.HALT, 0], { 20: 255 }, [
      { A: 0, PC: 2, mem: { 20: 0 } },
    ]);
  });

  it("MINUSONE wraps 0 → 255", () => {
    trace([Op.MINUSONE, 20, Op.HALT, 0], { 20: 0 }, [
      { A: 255, mem: { 20: 255 } },
    ]);
  });

  it("pointer-walk paints the top screen row (the §3.4 idiom)", () => {
    const prog = [
      Op.LOADC, 3,    // 0
      Op.STOREP, 12,  // 2
      Op.PLUSONE, 12, // 4
      Op.SUB, 13,     // 6
      Op.JNEG, 0,     // 8
      Op.HALT, 0,     // 10
      128,            // 12: ptr
      136,            // 13: last
    ];
    const final = run(createVM(prog));
    expect(final.halted).toBe(true);
    for (let addr = 128; addr < 136; addr++) expect(final.memory[addr]).toBe(3);
    expect(final.memory[136]).toBe(0); // stopped at the boundary
  });

  it("self-modifying program (Unit 2 lesson)", () => {
    // LOADC 7 / STORE 5 / LOADC 0 — the STORE rewrites the third instruction.
    const prog = [Op.LOADC, 7, Op.STORE, 5, Op.LOADC, 0, Op.HALT, 0];
    let s = createVM(prog);
    s = step(step(step(s)));
    expect(s.A).toBe(7);
    expect(s.memory[5]).toBe(7);
  });

  it("halts with a child-readable error on an unknown opcode", () => {
    const final = step(createVM([99, 0]));
    expect(final.halted).toBe(true);
    expect(final.error).toContain("99");
  });

  it("RANDOM (box 193) is deterministic per seed", () => {
    const prog = [Op.LOAD, 193, Op.STORE, 40, Op.LOAD, 193, Op.STORE, 41, Op.HALT, 0];
    const a = run(createVM(prog, 12345));
    const b = run(createVM(prog, 12345));
    expect(a.memory[40]).toBe(b.memory[40]);
    expect(a.memory[41]).toBe(b.memory[41]);
    // consecutive reads differ in general; with this seed they must
    expect(a.memory[40]).not.toBe(a.memory[41]);
  });

  it("step is pure: the input state is never mutated", () => {
    const before = createVM([Op.LOADC, 9, Op.STORE, 40, Op.HALT, 0]);
    const memCopy = Array.from(before.memory);
    const after = step(step(before));
    expect(Array.from(before.memory)).toEqual(memCopy);
    expect(before.A).toBe(0);
    expect(before.PC).toBe(0);
    expect(after.memory[40]).toBe(9);
  });

  it("stepping a halted machine is a no-op", () => {
    const halted = step(createVM([Op.HALT, 0]));
    expect(halted.halted).toBe(true);
    expect(step(halted)).toBe(halted);
  });

  it("run() stops at the step cap on infinite loops", () => {
    const final = run(createVM([Op.JUMP, 0]), 500);
    expect(final.halted).toBe(false);
    expect(final.steps).toBe(500);
  });
});
