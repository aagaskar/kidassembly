import { describe, expect, it } from "vitest";
import { Op } from "../src/vm/types";
import { createVM, pokeMemory, run } from "../src/vm/vm";
import { fromSnapshot, stateHash, toSnapshot } from "../src/vm/snapshot";

describe("snapshot round-trip (Phase 1 acceptance)", () => {
  it("save → JSON → load reproduces byte-identical machine state", () => {
    // Build a non-trivial state: run a program, then poke some pixels.
    let s = run(createVM([Op.LOADC, 9, Op.STORE, 130, Op.LOADC, 3, Op.STORE, 150, Op.HALT, 0]));
    s = pokeMemory(s, 200, 123);

    const json = JSON.stringify(toSnapshot(s, "round-trip test"));
    const restored = fromSnapshot(JSON.parse(json));

    expect(stateHash(restored)).toBe(stateHash(s));
    expect(Array.from(restored.memory)).toEqual(Array.from(s.memory));
    expect(restored.A).toBe(s.A);
    expect(restored.PC).toBe(s.PC);
    expect(restored.SP).toBe(s.SP);
  });

  it("hash changes when any visible state changes", () => {
    const base = createVM();
    expect(stateHash(pokeMemory(base, 0, 1))).not.toBe(stateHash(base));
    expect(stateHash({ ...base, A: 1 })).not.toBe(stateHash(base));
    expect(stateHash({ ...base, PC: 1 })).not.toBe(stateHash(base));
    expect(stateHash({ ...base, SP: 1 })).not.toBe(stateHash(base));
  });

  it("preserves notes and rejects files it can't honor", () => {
    const snap = toSnapshot(createVM(), "can you fix my draw loop?");
    expect(snap.notes).toBe("can you fix my draw loop?");

    expect(() => fromSnapshot({ ...snap, format: "nope" as never })).toThrow();
    expect(() => fromSnapshot({ ...snap, formatVersion: 2 as never })).toThrow(/version 2/);
    expect(() => fromSnapshot({ ...snap, memory: [1, 2, 3] })).toThrow(/256/);
  });
});
