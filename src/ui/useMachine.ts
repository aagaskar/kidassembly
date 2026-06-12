import { useCallback, useEffect, useRef, useState } from "react";
import { VMState } from "../vm/types";
import { pokeMemory, step } from "../vm/vm";

const HISTORY_CAP = 5000;

export interface Machine {
  state: VMState;
  canStepBack: boolean;
  running: boolean;
  speed: number; // steps per second
  doStep: () => void;
  stepBack: () => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: number) => void;
  reset: (s: VMState) => void;
  poke: (addr: number, value: number) => void;
}

/**
 * Holds a history of immutable VM states so step-back is just a pop.
 * Pokes (memory edits, key presses) replace the present state in place
 * rather than appending — they aren't execution steps to rewind through.
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

  useEffect(() => {
    if (!running) return;
    if (state.halted) {
      setRunning(false);
      return;
    }
    const id = setInterval(doStep, Math.max(1000 / speed, 10));
    return () => clearInterval(id);
  }, [running, speed, state.halted, doStep]);

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
