import {
  ADDR_RANDOM,
  MAX_OPCODE,
  MEM_SIZE,
  Op,
  STACK_TOP,
  VMState,
} from "./types";

const byte = (n: number) => ((n % 256) + 256) % 256;

/** xorshift32 — small, deterministic, good enough for a toy machine. */
function nextRng(rng: number): number {
  let x = rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}

export function createVM(program?: ArrayLike<number>, seed = 1): VMState {
  const memory = new Uint8Array(MEM_SIZE);
  if (program) memory.set(Array.from(program, byte), 0);
  return {
    machine: "bb8",
    memory,
    A: 0,
    PC: 0,
    SP: STACK_TOP,
    halted: false,
    error: null,
    rng: seed === 0 ? 1 : seed | 0,
    steps: 0,
  };
}

interface ReadResult {
  value: number;
  rng: number;
}

/** Memory read with MMIO: RANDOM (193) yields a fresh byte each read. */
function readMem(memory: Uint8Array, rng: number, addr: number): ReadResult {
  if (addr === ADDR_RANDOM) {
    const next = nextRng(rng);
    return { value: byte(next >>> 8), rng: next };
  }
  return { value: memory[addr], rng };
}

function withWrite(memory: Uint8Array, addr: number, value: number): Uint8Array {
  const out = new Uint8Array(memory);
  out[addr] = byte(value);
  return out;
}

/** Execute one fetch–decode–execute cycle. Pure: never mutates `state`. */
export function step(state: VMState): VMState {
  if (state.halted) return state;

  const { memory } = state;
  const opcode = memory[state.PC];
  const operand = memory[byte(state.PC + 1)];
  const nextPC = byte(state.PC + 2);
  const steps = state.steps + 1;

  if (opcode > MAX_OPCODE) {
    return {
      ...state,
      halted: true,
      steps,
      error: `I don't know an instruction numbered ${opcode}. The machine stopped at box ${state.PC}.`,
    };
  }

  switch (opcode as Op) {
    case Op.HALT:
      return { ...state, halted: true, steps };

    case Op.LOADC:
      return { ...state, A: operand, PC: nextPC, steps };

    case Op.LOAD: {
      const r = readMem(memory, state.rng, operand);
      return { ...state, A: r.value, rng: r.rng, PC: nextPC, steps };
    }

    case Op.STORE:
      return { ...state, memory: withWrite(memory, operand, state.A), PC: nextPC, steps };

    case Op.ADD: {
      const r = readMem(memory, state.rng, operand);
      return { ...state, A: byte(state.A + r.value), rng: r.rng, PC: nextPC, steps };
    }

    case Op.SUB: {
      const r = readMem(memory, state.rng, operand);
      return { ...state, A: byte(state.A - r.value), rng: r.rng, PC: nextPC, steps };
    }

    case Op.JUMP:
      return { ...state, PC: operand, steps };

    case Op.JZ:
      return { ...state, PC: state.A === 0 ? operand : nextPC, steps };

    case Op.JNEG:
      return { ...state, PC: state.A >= 128 ? operand : nextPC, steps };

    case Op.LOADP: {
      const ptr = readMem(memory, state.rng, operand);
      const val = readMem(memory, ptr.rng, ptr.value);
      return { ...state, A: val.value, rng: val.rng, PC: nextPC, steps };
    }

    case Op.STOREP: {
      const ptr = readMem(memory, state.rng, operand);
      return {
        ...state,
        memory: withWrite(memory, ptr.value, state.A),
        rng: ptr.rng,
        PC: nextPC,
        steps,
      };
    }

    case Op.CALL:
      return {
        ...state,
        memory: withWrite(memory, state.SP, nextPC),
        SP: byte(state.SP - 1),
        PC: operand,
        steps,
      };

    case Op.RET: {
      const sp = byte(state.SP + 1);
      return { ...state, SP: sp, PC: memory[sp], steps };
    }

    case Op.PUSH:
      return {
        ...state,
        memory: withWrite(memory, state.SP, state.A),
        SP: byte(state.SP - 1),
        PC: nextPC,
        steps,
      };

    case Op.POP: {
      const sp = byte(state.SP + 1);
      return { ...state, SP: sp, A: memory[sp], PC: nextPC, steps };
    }

    case Op.PLUSONE: {
      const r = readMem(memory, state.rng, operand);
      const v = byte(r.value + 1);
      return {
        ...state,
        memory: withWrite(memory, operand, v),
        A: v,
        rng: r.rng,
        PC: nextPC,
        steps,
      };
    }

    case Op.MINUSONE: {
      const r = readMem(memory, state.rng, operand);
      const v = byte(r.value - 1);
      return {
        ...state,
        memory: withWrite(memory, operand, v),
        A: v,
        rng: r.rng,
        PC: nextPC,
        steps,
      };
    }
  }
}

/** Run until HALT or `maxSteps`, whichever comes first. */
export function run(state: VMState, maxSteps = 100_000): VMState {
  let s = state;
  for (let i = 0; i < maxSteps && !s.halted; i++) s = step(s);
  return s;
}

/** Host-side helpers (keyboard and clock are just memory). */
export function pokeMemory(state: VMState, addr: number, value: number): VMState {
  return { ...state, memory: withWrite(state.memory, byte(addr), value) };
}
