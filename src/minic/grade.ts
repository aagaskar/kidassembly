import { TargetCase, TargetCheck } from "../engine/types";
import { assemble } from "../asm/assemble";
import { createVM, pokeMemory, run } from "../vm/vm";
import { VMState } from "../vm/types";
import { compileC } from "./compile";
import { MiniCError } from "./parser";

export interface MiniCBuilt {
  asm: string;
  lineMap: Record<number, number>;
  bytes: number[];
  addrToLine: Record<number, number>;
  symbols: Record<string, number>;
}

/** Compile + assemble, returning a child-readable error string on failure. */
export function buildMiniC(source: string): { built: MiniCBuilt | null; error: string | null } {
  try {
    const compiled = compileC(source);
    const assembled = assemble(compiled.asm, "bb16");
    if (!assembled.result) {
      return { built: null, error: assembled.errors[0]?.message ?? "assembly failed" };
    }
    return {
      built: {
        asm: compiled.asm,
        lineMap: compiled.lineMap,
        bytes: assembled.result.bytes,
        addrToLine: assembled.result.addrToLine,
        symbols: assembled.result.symbols,
      },
      error: null,
    };
  } catch (e) {
    if (e instanceof MiniCError) {
      return { built: null, error: `Line ${e.line}: ${e.message}` };
    }
    return { built: null, error: String(e) };
  }
}

function readWord(state: VMState, addr: number): number {
  return state.memory[addr] | (state.memory[addr + 1] << 8);
}

export function runMiniCCase(
  built: MiniCBuilt,
  c: TargetCase,
  maxSteps: number
): { pass: boolean; final: VMState; why: string | null } {
  let s = createVM(built.bytes, 1, "bb16");
  if (c.memory) {
    for (const [addr, value] of Object.entries(c.memory)) s = pokeMemory(s, Number(addr), value);
  }
  if (c.symbols) {
    for (const [name, value] of Object.entries(c.symbols)) {
      const addr = built.symbols[name];
      if (addr === undefined) {
        return { pass: false, final: s, why: `Your program needs a global called "${name}".` };
      }
      s = pokeMemory(s, addr, value & 0xff);
      s = pokeMemory(s, addr + 1, (value >> 8) & 0xff);
    }
  }
  const final = run(s, maxSteps);
  if (!final.halted) return { pass: false, final, why: "It ran and ran and never finished — check your loop's exit." };
  if (final.error) return { pass: false, final, why: final.error };
  if (c.A !== undefined && final.A !== c.A) {
    return { pass: false, final, why: `main returned ${final.A}, but the test wanted ${c.A}.` };
  }
  if (c.cells) {
    for (const [addr, value] of Object.entries(c.cells)) {
      if (final.memory[Number(addr)] !== value) {
        return {
          pass: false,
          final,
          why: `Box ${addr} ended as ${final.memory[Number(addr)]}, but the test wanted ${value}.`,
        };
      }
    }
  }
  if (c.expectSymbols) {
    for (const [name, value] of Object.entries(c.expectSymbols)) {
      const addr = built.symbols[name];
      if (addr === undefined) {
        return { pass: false, final, why: `Your program needs a global called "${name}".` };
      }
      if (readWord(final, addr) !== value) {
        return {
          pass: false,
          final,
          why: `${name} ended as ${readWord(final, addr)}, but the test wanted ${value}.`,
        };
      }
    }
  }
  return { pass: true, final, why: null };
}

export function gradeMiniC(
  source: string,
  check: TargetCheck
): { pass: boolean; error: string | null } {
  const { built, error } = buildMiniC(source);
  if (!built) return { pass: false, error };
  for (const c of check.cases) {
    const r = runMiniCCase(built, c, check.maxSteps ?? 2_000_000);
    if (!r.pass) return { pass: false, error: r.why };
  }
  return { pass: true, error: null };
}
