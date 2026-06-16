import { useEffect, useState } from "react";
import { configOf, VMState } from "../vm/types";
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

const PAGE = 256;

/**
 * 16×16 grid of memory cells. BitBot-8's whole memory fits one grid;
 * BitBot-16 shows one 256-byte page at a time with a page picker that
 * follows the PC while the machine runs.
 */
export function MemoryGrid({ state, viewMode, highlights = [], showPC = true, onPoke }: Props) {
  const cfg = configOf(state);
  const pages = cfg.memSize / PAGE;
  const [page, setPage] = useState(0);
  const [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const pcPage = Math.floor(state.PC / PAGE);
  useEffect(() => {
    if (pages > 1 && follow) setPage(pcPage);
  }, [pcPage, follow, pages]);

  const hiSet = new Set(highlights);
  const operandAddr = (state.PC + 1) % cfg.memSize;
  const operand2Addr = (state.PC + 2) % cfg.memSize;
  const base = pages > 1 ? page * PAGE : 0;

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
      {pages > 1 && (
        <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <span className="dim">page</span>
          {Array.from({ length: pages }, (_, p) => (
            <button
              key={p}
              className={"mini" + (p === page ? "" : " secondary")}
              onClick={() => {
                setPage(p);
                setFollow(false);
              }}
              title={`boxes ${p * PAGE}–${p * PAGE + PAGE - 1}`}
            >
              {p}
            </button>
          ))}
          <label className="dim" style={{ marginLeft: 8 }}>
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            follow PC
          </label>
        </div>
      )}
      <div className="memgrid">
        {Array.from({ length: PAGE }, (_, i) => {
          const addr = base + i;
          const value = state.memory[addr];
          const isScreen = addr >= cfg.screenStart && addr <= cfg.screenEnd;
          const classes = ["memcell"];
          if (isScreen) classes.push("vram");
          if (value === 0 && viewMode !== "color") classes.push("zero");
          if (showPC && !state.halted && addr === state.PC) classes.push("pc");
          if (
            showPC &&
            !state.halted &&
            (addr === operandAddr || (cfg.instrBytes === 3 && addr === operand2Addr)) &&
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
