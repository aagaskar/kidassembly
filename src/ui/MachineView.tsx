import { useState } from "react";
import { decodeAt } from "../vm/decode";
import { Machine } from "./useMachine";
import { MemoryGrid, ViewMode } from "./MemoryGrid";
import { RegisterPanel } from "./RegisterPanel";
import { ScreenPanel } from "./ScreenPanel";

interface Props {
  machine: Machine;
  highlights?: number[];
  /** Show step/run/back controls. */
  controls?: boolean;
  /** Allow memory editing / pixel painting. */
  editable?: boolean;
  paintColor?: number;
  showSP?: boolean;
  initialView?: ViewMode;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  dec: "123",
  bin: "0101",
  ascii: "abc",
  color: "🎨",
};

export function MachineView({
  machine,
  highlights,
  controls = true,
  editable = false,
  paintColor = 7,
  showSP = false,
  initialView = "dec",
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const { state } = machine;
  const decoded = decodeAt(state);

  return (
    <div className="col">
      <div className="row">
        <div className="col">
          <div className="row" style={{ gap: 4 }}>
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map((m) => (
              <button
                key={m}
                className={m === viewMode ? "" : "secondary"}
                onClick={() => setViewMode(m)}
                title={`show boxes as ${m}`}
              >
                {VIEW_LABELS[m]}
              </button>
            ))}
          </div>
          <MemoryGrid
            state={state}
            viewMode={viewMode}
            highlights={highlights}
            onPoke={editable ? machine.poke : undefined}
          />
        </div>
        <div className="col">
          <RegisterPanel state={state} showSP={showSP} />
          <h3>Screen</h3>
          <ScreenPanel
            state={state}
            onPaint={editable ? (addr) => machine.poke(addr, paintColor) : undefined}
          />
        </div>
      </div>

      {!state.halted && (
        <div className="decode">
          <b>{decoded.mnemonic}</b> — {decoded.text}
        </div>
      )}
      {state.halted && state.error && <div className="decode" style={{ borderColor: "var(--bad)" }}>{state.error}</div>}

      {controls && (
        <div className="row" style={{ alignItems: "center" }}>
          <button onClick={machine.doStep} disabled={state.halted}>
            Step ▶
          </button>
          <button className="secondary" onClick={machine.stepBack} disabled={!machine.canStepBack}>
            ◀ Back
          </button>
          <button
            className="secondary"
            onClick={() => machine.setRunning(!machine.running)}
            disabled={state.halted}
          >
            {machine.running ? "Pause ⏸" : "Run ⏵⏵"}
          </button>
          <label className="dim">
            speed
            <input
              type="range"
              min={1}
              max={50}
              value={machine.speed}
              onChange={(e) => machine.setSpeed(Number(e.target.value))}
            />
          </label>
          <span className="dim">{state.steps} steps</span>
        </div>
      )}
    </div>
  );
}
