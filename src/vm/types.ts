export type MachineKind = "bb8" | "bb16";

/** BitBot machine state. Immutable: `step` returns a fresh state. */
export interface VMState {
  machine: MachineKind;
  /** 256 bytes (bb8) or 4096 bytes (bb16). Never mutated in place. */
  memory: Uint8Array;
  /** Accumulator: 0–255 (bb8) or 0–65535 (bb16). */
  A: number;
  /** Program counter. */
  PC: number;
  /** Stack pointer; stack grows downward. */
  SP: number;
  halted: boolean;
  /** Child-readable explanation when the machine stops unexpectedly. */
  error: string | null;
  /**
   * PRNG state backing the RANDOM cell. Keeping it in the state keeps
   * `step` a pure function, which is what makes step-back and golden-trace
   * testing work.
   */
  rng: number;
  /** Steps executed since reset (for run caps and telemetry). */
  steps: number;
}

/** Architectural constants per machine (§3.2, §3.3). */
export interface MachineConfig {
  memSize: number;
  screenStart: number;
  screenEnd: number; // inclusive
  screenW: number;
  screenH: number;
  addrKey: number;
  addrRandom: number;
  addrTick: number;
  /** Initial SP (next free cell for bb8; one past the stack for bb16). */
  stackInit: number;
  /** Bytes per instruction (opcode + operand). */
  instrBytes: number;
  /** Bytes per data word moved by LOAD/STORE/PUSH/POP. */
  wordBytes: number;
  /** A-register modulus. */
  wordMax: number;
}

export const MACHINES: Record<MachineKind, MachineConfig> = {
  bb8: {
    memSize: 256,
    screenStart: 128,
    screenEnd: 191,
    screenW: 8,
    screenH: 8,
    addrKey: 192,
    addrRandom: 193,
    addrTick: 194,
    stackInit: 255,
    instrBytes: 2,
    wordBytes: 1,
    wordMax: 256,
  },
  bb16: {
    memSize: 4096,
    screenStart: 2048,
    screenEnd: 3071,
    screenW: 32,
    screenH: 32,
    addrKey: 3072,
    addrRandom: 3073,
    addrTick: 3074,
    stackInit: 4094, // pre-decrement push: first word lands at 4092–4093
    instrBytes: 3, // opcode, operand-lo, operand-hi
    wordBytes: 2, // little-endian words
    wordMax: 65536,
  },
};

export const configOf = (state: { machine: MachineKind }): MachineConfig =>
  MACHINES[state.machine];

// BitBot-8 constants kept as named exports (used widely in Phase-1 code).
export const MEM_SIZE = MACHINES.bb8.memSize;
export const SCREEN_START = MACHINES.bb8.screenStart;
export const SCREEN_END = MACHINES.bb8.screenEnd;
export const SCREEN_W = MACHINES.bb8.screenW;
export const SCREEN_H = MACHINES.bb8.screenH;
export const ADDR_KEY = MACHINES.bb8.addrKey;
export const ADDR_RANDOM = MACHINES.bb8.addrRandom;
export const ADDR_TICK = MACHINES.bb8.addrTick;
export const STACK_TOP = MACHINES.bb8.stackInit;

export enum Op {
  HALT = 0,
  LOADC = 1,
  LOAD = 2,
  STORE = 3,
  ADD = 4,
  SUB = 5,
  JUMP = 6,
  JZ = 7,
  JNEG = 8,
  LOADP = 9,
  STOREP = 10,
  CALL = 11,
  RET = 12,
  PUSH = 13,
  POP = 14,
  PLUSONE = 15,
  MINUSONE = 16,
  // BitBot-16 only (§3.3): byte variants and SP-relative access.
  LOADB = 17,
  STOREB = 18,
  LOADS = 19,
  STORES = 20,
  /** Byte variants of the arrow instructions: `char*` dereference. */
  LOADPB = 21,
  STOREPB = 22,
}

export const MAX_OPCODE = 16; // bb8
export const MAX_OPCODE_BB16 = 22;
