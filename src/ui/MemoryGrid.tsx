import { useState } from "react";
import { SCREEN_END, SCREEN_START, VMState } from "../vm/types";
import { OP_INFO } from "../vm/decode";
import { colorFor } from "./palette";

export type ViewMode = "dec" | "bin" | "ascii" | "color";

interface Props {
  state: VMState;
  viewMode: ViewMode;
  /** Extra cells to spotlight (lesson highlights). */
  highlights?: number[];
  /** Show PC/operand highlight (on when a program is being traced). */
  showPC?: boolean;
  /** If set, clicking a cell selects it for editing. */
  onPoke?: (addr: number, value: number) => void;
}

function cellContent(value: number, mode: ViewMode) {
  switch (mode) {
    case "dec":
      return <span>{value}</span>;
    case "bin":
      return (
        <span className="bits">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} className={(value >> (7 - i)) & 1 ? "on" : ""} />
          ))}
        </span>
      );
    case "ascii":
      return <span>{value >= 32 && value <= 126 ? String.fromCharCode(value) : "·"}</span>;
    case "color":
      return null;
  }
}

export function MemoryGrid({ state, viewMode, highlights = [], showPC = true, onPoke }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const hiSet = new Set(highlights);
  const operandAddr = (state.PC + 1) % 256;

  const commit = () => {
    const v = parseInt(editValue, 10);
    if (selected !== null && onPoke && !Number.isNaN(v)) {
      onPoke(selected, ((v % 256) + 256) % 256);
    }
    setSelected(null);
    setEditValue("");
  };

  return (
    <div className="col">
      <div className="memgrid">
        {Array.from({ length: 256 }, (_, addr) => {
          const value = state.memory[addr];
          const isScreen = addr >= SCREEN_START && addr <= SCREEN_END;
          const classes = ["memcell"];
          if (isScreen) classes.push("screen");
          if (showPC && !state.halted && addr === state.PC) classes.push("pc");
          if (
            showPC &&
            !state.halted &&
            addr === operandAddr &&
            OP_INFO[state.memory[state.PC]]?.hasOperand
          ) {
            classes.push("operand");
          }
          if (hiSet.has(addr)) classes.push("hi");
          if (selected === addr) classes.push("selected");
          if (onPoke) classes.push("editable");
          return (
            <div
              key={addr}
              className={classes.join(" ")}
              title={`box ${addr} = ${value}`}
              style={viewMode === "color" ? { background: colorFor(value) } : undefined}
              onClick={
                onPoke
                  ? () => {
                      setSelected(addr);
                      setEditValue(String(value));
                    }
                  : undefined
              }
            >
              {cellContent(value, viewMode)}
            </div>
          );
        })}
      </div>
      {onPoke && selected !== null && (
        <div className="row" style={{ alignItems: "center" }}>
          <span>
            Box <b>{selected}</b> =
          </span>
          <input
            type="number"
            min={0}
            max={255}
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
          <button onClick={commit}>Set</button>
          <button className="secondary" onClick={() => setSelected(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
