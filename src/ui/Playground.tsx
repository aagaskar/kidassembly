import { useEffect, useMemo, useState } from "react";
import { configOf, MachineKind, VMState } from "../vm/types";
import { createVM, pokeMemory } from "../vm/vm";
import { fromSnapshot, SnapshotFile, toSnapshot } from "../vm/snapshot";
import { openTextFile, saveTextFile } from "../files/fileio";
import { programToText, textToProgram } from "../files/programText";
import { EXAMPLES } from "../content/examples";
import { SNAKE_MINIC } from "../content/snake";
import { SKILLS } from "../content/skills";
import { getSettings } from "../engine/profiles";
import { loadSkillStates, masteryOf } from "../engine/mastery";
import { assemble } from "../asm/assemble";
import { buildMiniC } from "../minic/grade";
import { runRealC, RealCResult, RC_SCREEN_W, RC_SCREEN_H } from "../realc/interpret";
import { PALETTE, colorFor } from "./palette";
import { useMachine } from "./useMachine";
import { MachineView } from "./MachineView";
import { AsmEditor, AsmListing } from "./AsmEditor";

type Mode = "bb8" | "asm" | "bb16" | "minic" | "realc";

interface ModeInfo {
  label: string;
  /** Skill that unlocks this tab (progressive unlock, §8.1). */
  unlockSkill: string | null;
  unlockHint: string;
}

const MODES: Record<Mode, ModeInfo> = {
  bb8: { label: "🔢 BitBot-8", unlockSkill: null, unlockHint: "" },
  asm: {
    label: "📝 Assembly",
    unlockSkill: "u04.mnemonics",
    unlockHint: "finish the Unit-4 assembler lesson",
  },
  bb16: {
    label: "🚀 BitBot-16",
    unlockSkill: "u09.bitbot16",
    unlockHint: "reach Unit 9",
  },
  minic: {
    label: "⌨️ MiniC",
    unlockSkill: "u09.variables",
    unlockHint: "start writing C in Unit 9",
  },
  realc: {
    label: "🌍 Real C",
    unlockSkill: "u15.travel_guide",
    unlockHint: "finish the Unit-15 travel guide",
  },
};

export function Playground({ profileId, onExit }: { profileId: string; onExit: () => void }) {
  const [mode, setMode] = useState<Mode>("bb8");

  const unlocked = useMemo(() => {
    const settings = getSettings(profileId);
    const states = loadSkillStates(profileId);
    const has = (id: string | null) => {
      if (id === null || settings.unlockAll) return true;
      const skill = SKILLS.find((s) => s.id === id);
      if (!skill) return true;
      const m = masteryOf(skill, states);
      return m === "mastered" || m === "relearning";
    };
    return Object.fromEntries(
      (Object.keys(MODES) as Mode[]).map((m) => [m, has(MODES[m].unlockSkill)])
    ) as Record<Mode, boolean>;
  }, [profileId]);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>🛠 Playground</h2>
        <button className="secondary" onClick={onExit}>
          ✕ Back
        </button>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            className={m === mode ? "" : "secondary"}
            disabled={!unlocked[m]}
            title={unlocked[m] ? "" : `Locked — ${MODES[m].unlockHint}. (Grown-ups can unlock everything from 📊.)`}
            onClick={() => setMode(m)}
          >
            {unlocked[m] ? MODES[m].label : `🔒 ${MODES[m].label}`}
          </button>
        ))}
      </div>
      {mode === "bb8" && <MachinePlayground machine="bb8" key="bb8" />}
      {mode === "asm" && <AsmPlayground machine="bb8" key="asm8" />}
      {mode === "bb16" && <AsmPlayground machine="bb16" key="asm16" />}
      {mode === "minic" && <MiniCPlayground key="minic" />}
      {mode === "realc" && <RealCPlayground key="realc" />}
    </div>
  );
}

// ------------------------------------------------- raw machine playground

function MachinePlayground({ machine: kind }: { machine: MachineKind }) {
  const initial = useMemo(() => createVM([], 1, kind), [kind]);
  const machine = useMachine(initial);
  const [paintColor, setPaintColor] = useState(7);
  const [message, setMessage] = useState<string | null>(null);
  const cfg = configOf(machine.state);

  const say = (m: string) => setMessage(m);

  const loadExample = (index: number) => {
    if (index < 0) return;
    const ex = EXAMPLES[index];
    let s = createVM(ex.program ?? [], 1, kind);
    if (ex.memory) {
      for (const [addr, value] of Object.entries(ex.memory)) {
        s = pokeMemory(s, Number(addr), value);
      }
    }
    machine.reset(s);
    say(ex.description);
  };

  const rewind = () => {
    const s: VMState = {
      ...machine.state,
      A: 0,
      PC: 0,
      SP: cfg.stackInit,
      halted: false,
      error: null,
      steps: 0,
    };
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
      machine.reset(createVM(textToProgram(text), 1, kind));
      say("Program loaded into boxes starting at 0. Press Step or Run!");
    } catch (e) {
      say(e instanceof Error ? e.message : "That file didn't look like a program.");
    }
  };

  return (
    <div>
      <p className="dim">
        No grading here — poke boxes, paint pixels, run anything. The screen IS memory: paint a
        pixel and watch its box change; change a screen box and watch the pixel.
      </p>

      <div className="panel row" style={{ alignItems: "center", flexWrap: "wrap" }}>
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
        <button className="secondary" onClick={() => machine.reset(createVM([], 1, kind))}>
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
        <KeyCapture machine={machine} />
      </div>
    </div>
  );
}

function KeyCapture({ machine }: { machine: ReturnType<typeof useMachine> }) {
  const cfg = configOf(machine.state);
  return (
    <div
      className="keycapture"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key.length === 1) {
          machine.poke(cfg.addrKey, e.key.toUpperCase().charCodeAt(0));
          e.preventDefault();
        }
      }}
    >
      ⌨️ Click here, then press a key — its code lands in box {cfg.addrKey} (the KEY box).
    </div>
  );
}

// ----------------------------------------------------- assembly playground

const ASM_STARTERS: Record<MachineKind, string> = {
  bb8: "; Paint the top row, with a pointer walk (Unit 6)\n        LOADC 128\n        STORE ptr\nloop:   LOADC 3\n        STOREP ptr\n        PLUSONE ptr\n        SUB last\n        JNEG loop\n        HALT\nptr:    .byte 0\nlast:   .byte 136\n",
  bb16: "; BitBot-16: words are 2 boxes, the screen is 2048-3071 (32x32)\nLOADC 9\nSTOREB 2048\nLOADC 40000\nSTORE big\nHALT\nbig: .word 0\n",
};

function AsmPlayground({ machine: kind }: { machine: MachineKind }) {
  const [source, setSource] = useState(ASM_STARTERS[kind]);
  const initial = useMemo(() => createVM([], 1, kind), [kind]);
  const machine = useMachine(initial);
  const [paintColor, setPaintColor] = useState(7);

  const assembled = useMemo(() => assemble(source, kind), [source, kind]);
  const activeLine = assembled.result?.addrToLine[machine.state.PC];

  const load = () => {
    if (!assembled.result) return;
    machine.reset(createVM(assembled.result.bytes, 1, kind));
  };

  const saveSrc = () => saveTextFile(`program.${kind}.asm`, source, "text/plain");
  const openSrc = async () => {
    const text = await openTextFile(".asm,.txt,text/plain");
    if (text !== null) setSource(text);
  };

  return (
    <div>
      <p className="dim">
        Write assembly, load it into the machine, run it. The bytes next to your code are the
        assembler showing its work.
      </p>
      <div className="panel">
        <AsmEditor value={source} onChange={setSource} machine={kind} activeLine={activeLine} />
        <div className="row" style={{ alignItems: "center" }}>
          <button onClick={load} disabled={!assembled.result}>
            ⬇ Load into machine
          </button>
          <button className="secondary" onClick={saveSrc}>💾 Save</button>
          <button className="secondary" onClick={openSrc}>📂 Open</button>
        </div>
      </div>
      <div className="panel">
        <div className="row" style={{ alignItems: "center" }}>
          <span>Paint color:</span>
          <div className="swatches">
            {PALETTE.map((c, i) => (
              <div
                key={i}
                className={"swatch" + (i === paintColor ? " selected" : "")}
                style={{ background: c }}
                onClick={() => setPaintColor(i)}
              />
            ))}
          </div>
        </div>
        <MachineView machine={machine} editable paintColor={paintColor} showSP />
        <KeyCapture machine={machine} />
      </div>
    </div>
  );
}

// -------------------------------------------------------- MiniC playground

const MINIC_STARTER = `// MiniC on BitBot-16 — the compiler view is live below.
char* screen = (char*)2048;

int main() {
  for (int i = 0; i < 32; i = i + 1) {
    *(screen + i * 33) = 11;   // the diagonal
  }
  return 0;
}
`;

function MiniCPlayground() {
  const [source, setSource] = useState(MINIC_STARTER);
  const { built, error } = useMemo(() => buildMiniC(source), [source]);
  const initial = useMemo(() => createVM(built?.bytes ?? [0], 1, "bb16"), [built]);
  const machine = useMachine(initial);

  // Recompile-on-edit: a fresh build replaces the loaded machine.
  useEffect(() => {
    machine.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const asmLine = built ? built.addrToLine[machine.state.PC] : undefined;
  const cLine = built && asmLine !== undefined ? built.lineMap[asmLine] : undefined;

  const saveSrc = () => saveTextFile("program.minic", source, "text/plain");
  const openSrc = async () => {
    const text = await openTextFile(".minic,.c,.txt,text/plain");
    if (text !== null) setSource(text);
  };

  return (
    <div>
      <p className="dim">
        Write C, watch the compiler translate, step both sides in sync. Load Snake from the
        examples and steer with W A S D!
      </p>
      <div className="panel">
        <div className="row" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <button className="secondary" onClick={() => setSource(SNAKE_MINIC)}>🐍 Load Snake</button>
          <button className="secondary" onClick={() => setSource(MINIC_STARTER)}>↺ Starter</button>
          <button className="secondary" onClick={saveSrc}>💾 Save</button>
          <button className="secondary" onClick={openSrc}>📂 Open</button>
        </div>
        <div className="row cview">
          <div className="cview-pane">
            <h4>C</h4>
            <textarea
              className="asm-text c-edit"
              value={source}
              spellCheck={false}
              rows={Math.min(24, Math.max(12, source.split("\n").length + 1))}
              onChange={(e) => setSource(e.target.value)}
            />
            <CHighlight source={source} line={cLine} />
          </div>
          <div className="cview-pane asm-scroll">
            <h4>Compiled BitBot-16 assembly</h4>
            {built ? <AsmListing source={built.asm} activeLine={asmLine} /> : <p className="dim">(fix the C first)</p>}
          </div>
        </div>
        {error && <p className="feedback-bad">{error}</p>}
      </div>
      <div className="panel">
        <MachineView machine={machine} showSP />
        <KeyCapture machine={machine} />
      </div>
    </div>
  );
}

/** Read-only mirror of the C source with the active line highlighted. */
function CHighlight({ source, line }: { source: string; line?: number }) {
  if (line === undefined) return null;
  const text = source.split("\n")[line]?.trim();
  if (!text) return null;
  return (
    <div className="decode">
      C line {line + 1}: <b>{text}</b>
    </div>
  );
}

// ------------------------------------------------------- real C playground

const REALC_STARTER = `// Real C: 32-bit ints, printf, and a pixel() library.
// No memory-mapped screen here -- that's a BitBot thing (travel guide!).

int main() {
  printf("BitBot int says 60000 + 10000 = %d\\n", 4464);
  printf("Real C says   60000 + 10000 = %d\\n", 60000 + 10000);
  for (int i = 0; i < 32; i = i + 1) {
    pixel(i, i, 11);
  }
  return 0;
}
`;

function RealCPlayground() {
  const [source, setSource] = useState(REALC_STARTER);
  const [result, setResult] = useState<RealCResult | null>(null);

  return (
    <div>
      <p className="dim">
        The same C, on a grown-up machine: 32-bit ints, a real stack (& works on locals!),
        printf( ), pixel( ), rand( ). Sandboxed — runaway programs get stopped, not your browser.
      </p>
      <div className="panel">
        <textarea
          className="asm-text c-edit"
          value={source}
          spellCheck={false}
          rows={Math.min(24, Math.max(12, source.split("\n").length + 1))}
          onChange={(e) => setSource(e.target.value)}
        />
        <div className="row" style={{ alignItems: "center" }}>
          <button onClick={() => setResult(runRealC(source))}>▶ Compile and run</button>
          <button className="secondary" onClick={() => setSource(REALC_STARTER)}>↺ Starter</button>
          {result && (
            <span className="dim">
              finished in {result.steps.toLocaleString()} steps
              {result.returnValue !== null && ` — main returned ${result.returnValue}`}
            </span>
          )}
        </div>
      </div>
      {result && (
        <div className="panel row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h4>Console</h4>
            {result.error && <p className="feedback-bad">{result.error}</p>}
            <pre className="console">
              {result.output.length > 0 ? result.output.join("\n") : "(no output)"}
            </pre>
          </div>
          <div>
            <h4>pixel( ) canvas</h4>
            <div className="screen" style={{ gridTemplateColumns: `repeat(${RC_SCREEN_W}, 7px)` }}>
              {Array.from({ length: RC_SCREEN_W * RC_SCREEN_H }, (_, i) => (
                <div
                  key={i}
                  className="pixel"
                  style={{ background: colorFor(result.screen[i]), width: 7, height: 7 }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
