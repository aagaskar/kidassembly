import { useMemo, useState } from "react";
import { Step } from "../engine/types";
import { buildMiniC, MiniCBuilt, runMiniCCase } from "../minic/grade";
import { createVM } from "../vm/vm";
import { AsmListing } from "./AsmEditor";
import { useMachine } from "./useMachine";
import { MachineView } from "./MachineView";

interface Props {
  step: Extract<Step, { kind: "minic" }>;
  onDone: () => void;
  onOutcome?: (correct: boolean) => void;
}

/**
 * The MiniC compiler view (§1, §7 Phase 4): C on the left, the BitBot-16
 * assembly it compiles to on the right, stepped in sync — both highlight
 * together, driven by PC → asm line → C line through the source map.
 */
export function MiniCStep({ step, onDone, onOutcome }: Props) {
  const [source, setSource] = useState(step.source);
  const [reported, setReported] = useState(false);
  const [result, setResult] = useState<"none" | "pass" | "fail">("none");
  const [failMessage, setFailMessage] = useState("");

  const { built, error } = useMemo(() => buildMiniC(source), [source]);
  const editable = step.mode === "edit";

  const submit = () => {
    if (!built || !step.check) return;
    let pass = true;
    let why: string | null = null;
    for (const c of step.check.cases) {
      const r = runMiniCCase(built, c, step.check.maxSteps ?? 2_000_000);
      if (!r.pass) {
        pass = false;
        why = r.why;
        break;
      }
    }
    if (!reported) {
      setReported(true);
      onOutcome?.(pass);
    }
    setResult(pass ? "pass" : "fail");
    setFailMessage(why ?? "");
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      {editable ? (
        <div className="row cview">
          <div className="cview-pane">
            <h4>C</h4>
            <textarea
              className="asm-text c-edit"
              value={source}
              spellCheck={false}
              rows={Math.max(10, source.split("\n").length + 1)}
              onChange={(e) => {
                setSource(e.target.value);
                setResult("none");
              }}
            />
          </div>
          <div className="cview-pane">
            <h4>What the compiler makes of it</h4>
            {built ? <AsmListing source={built.asm} /> : <p className="dim">(fix the C first)</p>}
          </div>
        </div>
      ) : (
        <SyncedRunner built={built} source={source} />
      )}
      {error && <p className="feedback-bad">{error}</p>}
      {editable && (
        <div className="row" style={{ alignItems: "center" }}>
          <button onClick={submit} disabled={!built}>
            Compile and run the tests!
          </button>
          {result === "fail" && <span className="feedback-bad">{failMessage}</span>}
        </div>
      )}
      {(result === "pass" || !editable) && (
        <>
          {result === "pass" && <p className="feedback-good">All tests pass! ✓</p>}
          {result === "pass" && step.explain && <p>{step.explain}</p>}
          {!editable && step.explain && <p className="dim">{step.explain}</p>}
          <div style={{ marginTop: 12 }}>
            <button onClick={onDone}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

/** View mode: read-only C and asm panes stepping in sync over the machine. */
function SyncedRunner({ built, source }: { built: MiniCBuilt | null; source: string }) {
  const initial = useMemo(() => createVM(built?.bytes ?? [0], 1, "bb16"), [built]);
  const machine = useMachine(initial);
  if (!built) return <p className="dim">(this program doesn't compile)</p>;

  const asmLine = built.addrToLine[machine.state.PC];
  const cLine = asmLine !== undefined ? built.lineMap[asmLine] : undefined;

  return (
    <div className="col">
      <div className="row cview">
        <div className="cview-pane">
          <h4>C</h4>
          <pre className="c-listing">
            {source.split("\n").map((line, i) => (
              <div key={i} className={i === cLine ? "asm-active" : undefined}>
                {line || " "}
              </div>
            ))}
          </pre>
        </div>
        <div className="cview-pane asm-scroll">
          <h4>BitBot-16 assembly</h4>
          <AsmListing source={built.asm} activeLine={asmLine} />
        </div>
      </div>
      <MachineView machine={machine} controls showSP />
    </div>
  );
}
