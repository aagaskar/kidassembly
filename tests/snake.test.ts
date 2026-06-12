import { describe, expect, it } from "vitest";
import { SNAKE_MINIC } from "../src/content/snake";
import { buildMiniC } from "../src/minic/grade";
import { createVM, pokeMemory, run } from "../src/vm/vm";

/** §7 Phase-5 acceptance: Snake runs. Host pokes TICK/KEY like the UI does. */
describe("Snake capstone", () => {
  it("compiles, draws the snake, and moves on ticks", () => {
    const { built, error } = buildMiniC(SNAKE_MINIC);
    expect(error).toBeNull();

    let s = createVM(built!.bytes, 1, "bb16");
    s = run(s, 300_000); // restart() + first busy-wait on TICK
    expect(s.halted).toBe(false); // game loop never halts
    // initial snake at offsets 33–35 (color 3), food somewhere (color 12)
    expect(s.memory[2048 + 35]).toBe(3);
    expect(s.memory[2048 + 33]).toBe(3);
    expect(Array.from(s.memory.slice(2048, 3072))).toContain(12);

    // advance the clock → snake takes one step right (head to offset 36)
    s = pokeMemory(s, 3074, s.memory[3074] + 1);
    s = run(s, 300_000);
    expect(s.error).toBeNull();
    expect(s.memory[2048 + 36]).toBe(3); // new head
    expect(s.memory[2048 + 33]).toBe(0); // tail erased

    // steer up (W) and tick again: head moves to 36 - 32 = 4
    s = pokeMemory(s, 3072, 87);
    s = pokeMemory(s, 3074, s.memory[3074] + 1);
    s = run(s, 300_000);
    expect(s.error).toBeNull();
    expect(s.memory[2048 + 4]).toBe(3);
    expect(s.memory[3072]).toBe(0); // key consumed
  });
});
