import { describe, expect, it } from "vitest";
import { assemble } from "../src/asm/assemble";
import { createVM, run } from "../src/vm/vm";
import { Op } from "../src/vm/types";

describe("BitBot-8 assembler", () => {
  it("assembles mnemonics, labels, .byte, comments (§3.4 example)", () => {
    const src = `
        LOADC 128      ; address of first pixel
        STORE ptr
loop:   LOADC 3        ; color 3
        STOREP ptr     ; paint where ptr points
        PLUSONE ptr    ; move ptr to the next box (new value lands in A)
        SUB last       ; have we passed the screen?
        JNEG loop
        HALT
ptr:    .byte 0
last:   .byte 192
`;
    const { result, errors } = assemble(src, "bb8");
    expect(errors).toEqual([]);
    expect(result!.symbols.loop).toBe(4);
    expect(result!.symbols.ptr).toBe(16);
    expect(result!.symbols.last).toBe(17);
    expect(result!.bytes.slice(0, 4)).toEqual([Op.LOADC, 128, Op.STORE, 16]);

    // And the program actually paints the whole screen color 3.
    const final = run(createVM(result!.bytes));
    expect(final.halted).toBe(true);
    for (let a = 128; a <= 191; a++) expect(final.memory[a]).toBe(3);
  });

  it("supports char literals and multi-value .byte", () => {
    const { result, errors } = assemble(`msg: .byte 'H', 'I', 0`, "bb8");
    expect(errors).toEqual([]);
    expect(result!.bytes).toEqual([72, 73, 0]);
  });

  it("forward references work (label used before defined)", () => {
    const { result, errors } = assemble(`JUMP end\nend: HALT`, "bb8");
    expect(errors).toEqual([]);
    expect(result!.bytes).toEqual([Op.JUMP, 2, Op.HALT, 0]);
  });

  it("did-you-mean for misspelled labels (child-friendly errors)", () => {
    const { errors } = assemble(`MINUSONE cont\nHALT\ncount: .byte 5`, "bb8");
    expect(errors[0].message).toContain(`"cont"`);
    expect(errors[0].message).toContain(`"count"`);
  });

  it("did-you-mean for misspelled mnemonics", () => {
    const { errors } = assemble(`LODC 5`, "bb8");
    expect(errors[0].message).toContain("LOADC");
  });

  it("rejects bb16-only instructions on bb8", () => {
    const { errors } = assemble(`LOADB 5`, "bb8");
    expect(errors[0].message).toMatch(/BitBot-16/);
  });

  it("rejects missing and extra operands with plain words", () => {
    expect(assemble(`LOADC`, "bb8").errors[0].message).toMatch(/needs something after it/);
    expect(assemble(`HALT 4`, "bb8").errors[0].message).toMatch(/works alone/);
  });

  it("duplicate labels are an error", () => {
    const { errors } = assemble(`x: .byte 1\nx: .byte 2`, "bb8");
    expect(errors[0].message).toMatch(/twice/);
  });

  it("keeps a line↔address map for the editor and synced stepping", () => {
    const { result } = assemble(`LOADC 5\nSTORE 20\nHALT`, "bb8");
    expect(result!.lineToAddr).toEqual({ 0: 0, 1: 2, 2: 4 });
    expect(result!.addrToLine[2]).toBe(1);
    expect(result!.addrToLine[3]).toBe(1);
  });
});

describe("BitBot-16 assembler and machine", () => {
  it("emits 3-byte instructions with little-endian operands", () => {
    const { result, errors } = assemble(`LOADC 1000\nSTORE 2048\nHALT`, "bb16");
    expect(errors).toEqual([]);
    expect(result!.bytes).toEqual([Op.LOADC, 232, 3, Op.STORE, 0, 8, Op.HALT, 0, 0]);
  });

  it("words are 16-bit: STORE/LOAD round-trip a big number", () => {
    const { result } = assemble(
      `LOADC 40000\nSTORE big\nLOADC 0\nLOAD big\nHALT\nbig: .word 0`,
      "bb16"
    );
    const final = run(createVM(result!.bytes, 1, "bb16"));
    expect(final.A).toBe(40000);
  });

  it("LOADB/STOREB move single bytes", () => {
    const { result } = assemble(
      `LOADC 258\nSTOREB 3000\nLOADC 0\nLOADB 3000\nHALT`,
      "bb16"
    );
    const final = run(createVM(result!.bytes, 1, "bb16"));
    expect(final.A).toBe(2); // 258 & 0xff
  });

  it("PUSH/POP move words; CALL/RET use a word-sized return address", () => {
    const { result, errors } = assemble(
      `
LOADC 1234
PUSH
CALL fn
POP
HALT
fn: LOADC 7
RET
`,
      "bb16"
    );
    expect(errors).toEqual([]);
    const final = run(createVM(result!.bytes, 1, "bb16"));
    expect(final.A).toBe(1234); // POP got the pushed word back after the call
    expect(final.SP).toBe(4094);
  });

  it("LOADS/STORES read and write SP-relative words (frame access, §3.3)", () => {
    const { result, errors } = assemble(
      `
LOADC 500
PUSH          ; a "local" at SP+0
LOADC 9999
STORES 0      ; overwrite the local
LOADC 0
LOADS 0       ; read it back
HALT
`,
      "bb16"
    );
    expect(errors).toEqual([]);
    const final = run(createVM(result!.bytes, 1, "bb16"));
    expect(final.A).toBe(9999);
  });

  it("two's complement: JNEG fires on the 16-bit top bit", () => {
    const { result } = assemble(
      `LOADC 0\nSUB one\nJNEG neg\nHALT\nneg: LOADC 1\nHALT\none: .word 1`,
      "bb16"
    );
    const final = run(createVM(result!.bytes, 1, "bb16"));
    expect(final.A).toBe(1); // 0-1 wrapped to 65535, top bit set
  });

  it("screen lives at 2048: STOREB paints a pixel", () => {
    const { result } = assemble(`LOADC 5\nSTOREB 2048\nHALT`, "bb16");
    const final = run(createVM(result!.bytes, 1, "bb16"));
    expect(final.memory[2048]).toBe(5);
  });
});
