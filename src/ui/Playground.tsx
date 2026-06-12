import { useMemo, useState } from "react";
import { ADDR_KEY, VMState } from "../vm/types";
import { createVM, pokeMemory } from "../vm/vm";
import { fromSnapshot, SnapshotFile, toSnapshot } from "../vm/snapshot";
import { openTextFile, saveTextFile } from "../files/fileio";
import { programToText, textToProgram } from "../files/programText";
import { EXAMPLES } from "../content/examples";
import { PALETTE } from "./palette";
import { useMachine } from "./useMachine";
import { MachineView } from "./MachineView";

export function Playground({ onExit }: { onExit: () => void }) {
  const initial = useMemo(() => createVM(), []);
  const machine = useMachine(initial);
  const [paintColor, setPaintColor] = useState(7);
  const [message, setMessage] = useState<string | null>(null);

  const say = (m: string) => setMessage(m);

  const loadExample = (index: number) => {
    if (index < 0) return;
    const ex = EXAMPLES[index];
    let s = createVM(ex.program ?? []);
    if (ex.memory) {
      for (const [addr, value] of Object.entries(ex.memory)) {
        s = pokeMemory(s, Number(addr), value);
      }
    }
    machine.reset(s);
    say(ex.description);
  };

  const rewind = () => {
    // Keep memory as-is, send BitBot back to box 0.
    const s: VMState = { ...machine.state, A: 0, PC: 0, SP: 255, halted: false, error: null, steps: 0 };
    machine.reset(s);
    setMessage(null);
  };

  const saveSnap = () =>
    saveTextFile("bitbot-snapshot.json", JSON.stringify(toSnapshot(machine.state), null, 2));

  const loadSnap = async () => {
    const text = await openTextFile(".json,application/json");
    if (!text) return;
    try {
      machine.reset(fromSnapshot(JSON.parse(text) as SnapshotFile));
      say("Snapshot loaded — every box and register is back exactly as saved.");
    } catch (e) {
      say(e instanceof Error ? e.message : "That file didn't look like a snapshot.");
    }
  };

  const saveProgram = () =>
    saveTextFile(
      "program.bb8.txt",
      programToText(Array.from(machine.state.memory.slice(0, 128))),
      "text/plain"
    );

  const loadProgram = async () => {
    const text = await openTextFile(".txt,.bb8,text/plain");
    if (!text) return;
    try {
      machine.reset(createVM(textToProgram(text)));
      say("Program loaded into boxes starting at 0. Press Step or Run!");
    } catch (e) {
      say(e instanceof Error ? e.message : "That file didn't look like a program.");
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>🛠 Playground</h2>
        <button className="secondary" onClick={onExit}>
          ✕ Back
        </button>
      </div>
      <p className="dim">
        No grading here — poke boxes, paint pixels, run anything. The screen IS memory: paint a
        pixel and watch its box change; change a box (128–191) and watch the screen.
      </p>

      <div className="panel row" style={{ alignItems: "center" }}>
        <label>
          Examples:{" "}
          <select defaultValue={-1} onChange={(e) => loadExample(Number(e.target.value))}>
            <option value={-1} disabled>
              open one…
            </option>
            {EXAMPLES.map((ex, i) => (
              <option key={ex.name} value={i}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" onClick={rewind}>⏮ Rewind to box 0</button>
        <button className="secondary" onClick={() => machine.reset(createVM())}>
          🧹 Clear everything
        </button>
        <button className="secondary" onClick={saveProgram}>💾 Save program</button>
        <button className="secondary" onClick={loadProgram}>📂 Open program</button>
        <button className="secondary" onClick={saveSnap}>📸 Save snapshot</button>
        <button className="secondary" onClick={loadSnap}>🖼 Open snapshot</button>
      </div>

      {message && <div className="decode">{message}</div>}

      <div className="panel">
        <div className="row" style={{ alignItems: "center" }}>
          <span>Paint color:</span>
          <div className="swatches">
            {PALETTE.map((c, i) => (
              <div
                key={i}
                className={"swatch" + (i === paintColor ? " selected" : "")}
                style={{ background: c }}
                title={`color ${i}`}
                onClick={() => setPaintColor(i)}
              />
            ))}
          </div>
        </div>
        <MachineView machine={machine} editable paintColor={paintColor} showSP />
        <div
          className="keycapture"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key.length === 1) {
              machine.poke(ADDR_KEY, e.key.toUpperCase().charCodeAt(0));
              e.preventDefault();
            }
          }}
        >
          ⌨️ Click here, then press a key — its code lands in box {ADDR_KEY} (the KEY box).
        </div>
      </div>
    </div>
  );
}
