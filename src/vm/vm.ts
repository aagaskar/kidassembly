import {
  configOf,
  MachineKind,
  MACHINES,
  MAX_OPCODE,
  MAX_OPCODE_BB16,
  Op,
  VMState,
} from "./types";

/** xorshift32 — small, deterministic, good enough for a toy machine. */
function nextRng(rng: number): number {
  let x = rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}

export function createVM(program?: ArrayLike<number>, seed = 1, machine: MachineKind = "bb8"): VMState {
  const cfg = MACHINES[machine];
  const memory = new Uint8Array(cfg.memSize);
  if (program) memory.set(Array.from(program, (n) => ((n % 256) + 256) % 256), 0);
  return {
    machine,
    memory,
    A: 0,
    PC: 0,
    SP: cfg.stackInit,
    halted: false,
    error: null,
    rng: seed === 0 ? 1 : seed | 0,
    steps: 0,
  };
}

/** Execute one fetch–decode–execute cycle. Pure: never mutates `state`. */
export function step(state: VMState): VMState {
  if (state.halted) return state;

  const cfg = configOf(state);
  const { memory } = state;
  const is16 = state.machine === "bb16";
  const addrMask = (n: number) => ((n % cfg.memSize) + cfg.memSize) % cfg.memSize;
  const word = (n: number) => ((n % cfg.wordMax) + cfg.wordMax) % cfg.wordMax;

  /** Byte read with MMIO: RANDOM yields a fresh byte each read. */
  let rng = state.rng;
  const readByte = (addr: number): number => {
    const a = addrMask(addr);
    if (a === cfg.addrRandom) {
      rng = nextRng(rng);
      return (rng >>> 8) & 0xff;
    }
    return memory[a];
  };
  /** Word read: 1 byte on bb8, little-endian 2 bytes on bb16. */
  const readWord = (addr: number): number =>
    is16 ? readByte(addr) | (readByte(addr + 1) << 8) : readByte(addr);

  let out: Uint8Array | null = null;
  const writeByte = (addr: number, value: number) => {
    out ??= new Uint8Array(memory);
    out[addrMask(addr)] = value & 0xff;
  };
  const writeWord = (addr: number, value: number) => {
    writeByte(addr, value & 0xff);
    if (is16) writeByte(addr + 1, (value >> 8) & 0xff);
  };

  const opcode = memory[state.PC];
  const operand = is16
    ? memory[addrMask(state.PC + 1)] | (memory[addrMask(state.PC + 2)] << 8)
    : memory[addrMask(state.PC + 1)];
  const nextPC = addrMask(state.PC + cfg.instrBytes);
  const steps = state.steps + 1;

  const maxOp = is16 ? MAX_OPCODE_BB16 : MAX_OPCODE;
  if (opcode > maxOp) {
    return {
      ...state,
      halted: true,
      steps,
      error: `I don't know an instruction numbered ${opcode}. The machine stopped at box ${state.PC}.`,
    };
  }

  const done = (changes: Partial<VMState>): VMState => ({
    ...state,
    PC: nextPC,
    rng,
    steps,
    ...(out ? { memory: out } : null),
    ...changes,
  });

  switch (opcode as Op) {
    case Op.HALT:
      return { ...state, halted: true, steps };

    case Op.LOADC:
      return done({ A: operand });

    case Op.LOAD:
      return done({ A: readWord(operand) });

    case Op.STORE:
      writeWord(operand, state.A);
      return done({});

    case Op.ADD:
      return done({ A: word(state.A + readWord(operand)) });

    case Op.SUB:
      return done({ A: word(state.A - readWord(operand)) });

    case Op.JUMP:
      return done({ PC: addrMask(operand) });

    case Op.JZ:
      return done({ PC: state.A === 0 ? addrMask(operand) : nextPC });

    case Op.JNEG:
      return done({ PC: state.A >= cfg.wordMax / 2 ? addrMask(operand) : nextPC });

    case Op.LOADP: {
      const ptr = readWord(operand);
      return done({ A: readWord(ptr) });
    }

    case Op.STOREP: {
      const ptr = readWord(operand);
      writeWord(ptr, state.A);
      return done({});
    }

    case Op.CALL: {
      // bb8: push at SP then move down. bb16: pre-decrement, word push.
      const sp = is16 ? addrMask(state.SP - 2) : state.SP;
      writeWord(sp, nextPC);
      return done({
        SP: is16 ? sp : addrMask(state.SP - 1),
        PC: addrMask(operand),
      });
    }

    case Op.RET: {
      if (is16) {
        const pc = readWord(state.SP);
        return done({ SP: addrMask(state.SP + 2), PC: addrMask(pc) });
      }
      const sp = addrMask(state.SP + 1);
      return done({ SP: sp, PC: memory[sp] });
    }

    case Op.PUSH: {
      const sp = is16 ? addrMask(state.SP - 2) : state.SP;
      writeWord(sp, state.A);
      return done({ SP: is16 ? sp : addrMask(state.SP - 1) });
    }

    case Op.POP: {
      if (is16) {
        return done({ A: readWord(state.SP), SP: addrMask(state.SP + 2) });
      }
      const sp = addrMask(state.SP + 1);
      return done({ SP: sp, A: memory[sp] });
    }

    case Op.PLUSONE: {
      const v = word(readWord(operand) + 1);
      writeWord(operand, v);
      return done({ A: v });
    }

    case Op.MINUSONE: {
      const v = word(readWord(operand) - 1);
      writeWord(operand, v);
      return done({ A: v });
    }

    // ------------------------------------------------ BitBot-16 only
    case Op.LOADB:
      return done({ A: readByte(operand) });

    case Op.STOREB:
      writeByte(operand, state.A & 0xff);
      return done({});

    case Op.LOADS:
      return done({ A: readWord(state.SP + operand) });

    case Op.STORES:
      writeWord(state.SP + operand, state.A);
      return done({});

    case Op.LOADPB:
      return done({ A: readByte(readWord(operand)) });

    case Op.STOREPB:
      writeByte(readWord(operand), state.A & 0xff);
      return done({});
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
  const cfg = configOf(state);
  const a = ((addr % cfg.memSize) + cfg.memSize) % cfg.memSize;
  const memory = new Uint8Array(state.memory);
  memory[a] = value & 0xff;
  return { ...state, memory };
}
