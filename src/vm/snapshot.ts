import { MEM_SIZE, VMState } from "./types";
import { createVM, pokeMemory } from "./vm";

/** On-disk snapshot format (§8.3 of the design doc). */
export interface SnapshotFile {
  format: "bitbot-snap";
  formatVersion: 1;
  machine: "bb8";
  memory: number[];
  registers: { A: number; PC: number; SP: number };
  notes?: string;
}

export function toSnapshot(state: VMState, notes?: string): SnapshotFile {
  const snap: SnapshotFile = {
    format: "bitbot-snap",
    formatVersion: 1,
    machine: state.machine,
    memory: Array.from(state.memory),
    registers: { A: state.A, PC: state.PC, SP: state.SP },
  };
  if (notes) snap.notes = notes;
  return snap;
}

export function fromSnapshot(snap: SnapshotFile): VMState {
  if (snap.format !== "bitbot-snap") {
    throw new Error("This file isn't a BitBot snapshot.");
  }
  if (snap.formatVersion !== 1) {
    throw new Error(
      `This snapshot is version ${snap.formatVersion}, which this app doesn't understand yet.`
    );
  }
  if (snap.memory.length !== MEM_SIZE) {
    throw new Error(
      `A BitBot-8 snapshot needs exactly ${MEM_SIZE} memory cells, found ${snap.memory.length}.`
    );
  }
  let state = createVM();
  for (let i = 0; i < MEM_SIZE; i++) state = pokeMemory(state, i, snap.memory[i]);
  return {
    ...state,
    A: snap.registers.A & 0xff,
    PC: snap.registers.PC & 0xff,
    SP: snap.registers.SP & 0xff,
  };
}

/**
 * FNV-1a hash over the architecturally visible machine state
 * (memory + registers). Used by the round-trip acceptance test.
 */
export function stateHash(state: VMState): string {
  let h = 0x811c9dc5;
  const mix = (b: number) => {
    h ^= b & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  for (let i = 0; i < state.memory.length; i++) mix(state.memory[i]);
  mix(state.A);
  mix(state.PC);
  mix(state.SP);
  return (h >>> 0).toString(16).padStart(8, "0");
}
