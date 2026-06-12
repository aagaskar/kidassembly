import { VMState } from "../vm/types";

export function RegisterPanel({ state, showSP = false }: { state: VMState; showSP?: boolean }) {
  return (
    <div className="col">
      <div className="reg">
        <span className="name">A</span>
        <span className="val">{state.A}</span>
        <span className="bin">
          {state.A.toString(2).padStart(state.machine === "bb16" ? 16 : 8, "0")}
        </span>
      </div>
      <div className="reg">
        <span className="name">PC</span>
        <span className="val">{state.PC}</span>
        <span className="dim">next instruction box</span>
      </div>
      {showSP && (
        <div className="reg">
          <span className="name">SP</span>
          <span className="val">{state.SP}</span>
          <span className="dim">top of stack</span>
        </div>
      )}
      {state.halted && (
        <div className="reg">
          <span className="name">⏹</span>
          <span className="val" style={{ color: state.error ? "var(--bad)" : "var(--good)" }}>
            {state.error ? "stopped!" : "halted"}
          </span>
        </div>
      )}
    </div>
  );
}
