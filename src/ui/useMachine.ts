import { useCallback, useEffect, useRef, useState } from "react";
import { configOf, VMState } from "../vm/types";
import { pokeMemory, step } from "../vm/vm";

const HISTORY_CAP = 5000;
const RUN_INTERVAL_MS = 50;

export interface Machine {
  state: VMState;
  canStepBack: boolean;
  running: boolean;
  speed: number; // 1–50 slider; steps/second grows quadratically
  doStep: () => void;
  stepBack: () => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: number) => void;
  reset: (s: VMState) => void;
  poke: (addr: number, value: number) => void;
}

/** Slider position → steps per second (quadratic: 1 … 10,000). */
export function stepsPerSecond(speed: number): number {
  return Math.max(1, Math.round(speed * speed * 4));
}

/**
 * Holds a history of immutable VM states so step-back is just a pop.
 * Pokes (memory edits, key presses) replace the present state in place
 * rather than appending — they aren't execution steps to rewind through.
 *
 * While running, steps execute in batches per animation tick (one history
 * entry per batch, so step-back rewinds a batch), and the TICK cell
 * advances 10×/second — the clock is just memory the host pokes (§3.2).
 */
export function useMachine(initial: VMState): Machine {
  const [history, setHistory] = useState<VMState[]>([initial]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(4);

  const state = history[history.length - 1];
  const stateRef = useRef(state);
  stateRef.current = state;

  const doStep = useCallback(() => {
    setHistory((h) => {
      const present = h[h.length - 1];
      if (present.halted) return h;
      const next = [...h, step(present)];
      return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
    });
  }, []);

  const stepBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const reset = useCallback((s: VMState) => {
    setRunning(false);
    setHistory([s]);
  }, []);

  const poke = useCallback((addr: number, value: number) => {
    setHistory((h) => [...h.slice(0, -1), pokeMemory(h[h.length - 1], addr, value)]);
  }, []);

  // run loop: batch of steps per tick, one history entry per batch
  useEffect(() => {
    if (!running) return;
    if (state.halted) {
      setRunning(false);
      return;
    }
    const batch = Math.max(1, Math.round((stepsPerSecond(speed) * RUN_INTERVAL_MS) / 1000));
    const id = setInterval(() => {
      setHistory((h) => {
        let s = h[h.length - 1];
        if (s.halted) return h;
        for (let i = 0; i < batch && !s.halted; i++) s = step(s);
        const next = [...h, s];
        return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
      });
    }, RUN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running, speed, state.halted]);

  // TICK heartbeat: 10×/second while running (§3.2 memory map)
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setHistory((h) => {
        const present = h[h.length - 1];
        const cfg = configOf(present);
        const t = (present.memory[cfg.addrTick] + 1) & 0xff;
        return [...h.slice(0, -1), pokeMemory(present, cfg.addrTick, t)];
      });
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  return {
    state,
    canStepBack: history.length > 1,
    running,
    speed,
    doStep,
    stepBack,
    setRunning,
    setSpeed,
    reset,
    poke,
  };
}
