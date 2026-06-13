import { MachineKind, MACHINES, VMState } from "./types";
import { createVM, pokeMemory } from "./vm";

/** On-disk snapshot format (§8.3 of the design doc). */
export interface SnapshotFile {
  format: "bitbot-snap";
  formatVersion: 1;
  machine: MachineKind;
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
  const machine: MachineKind = snap.machine === "bb16" ? "bb16" : "bb8";
  const cfg = MACHINES[machine];
  if (snap.memory.length !== cfg.memSize) {
    throw new Error(
      `A ${machine === "bb16" ? "BitBot-16" : "BitBot-8"} snapshot needs exactly ${cfg.memSize} memory cells, found ${snap.memory.length}.`
    );
  }
  let state = createVM([], 1, machine);
  for (let i = 0; i < cfg.memSize; i++) state = pokeMemory(state, i, snap.memory[i]);
  const regMask = machine === "bb16" ? 0xffff : 0xff;
  return {
    ...state,
    A: snap.registers.A & regMask,
    PC: snap.registers.PC & regMask,
    // bb16's initial SP is 4096, one past the last cell — allow it.
    SP: Math.min(snap.registers.SP, cfg.stackInit) & 0x1ffff,
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
