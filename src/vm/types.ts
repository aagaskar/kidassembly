/** BitBot-8 machine state. Immutable: `step` returns a fresh state. */
export interface VMState {
  machine: "bb8";
  /** 256 bytes. Never mutated in place by the VM. */
  memory: Uint8Array;
  /** Accumulator, 0–255. */
  A: number;
  /** Program counter, 0–255. */
  PC: number;
  /** Stack pointer; stack grows downward from 255. */
  SP: number;
  halted: boolean;
  /** Child-readable explanation when the machine stops unexpectedly. */
  error: string | null;
  /**
   * PRNG state backing the RANDOM cell (193). Keeping it in the state keeps
   * `step` a pure function, which is what makes step-back and golden-trace
   * testing work.
   */
  rng: number;
  /** Steps executed since reset (for run caps and telemetry). */
  steps: number;
}

export const MEM_SIZE = 256;
export const SCREEN_START = 128;
export const SCREEN_END = 191; // inclusive
export const SCREEN_W = 8;
export const SCREEN_H = 8;
export const ADDR_KEY = 192;
export const ADDR_RANDOM = 193;
export const ADDR_TICK = 194;
export const STACK_TOP = 255;

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
}

export const MAX_OPCODE = 16;
