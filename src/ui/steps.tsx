import { useMemo, useState } from "react";
import { Step, TargetCase } from "../engine/types";
import { gradeParsons, gradeTarget, traceExpected, buildState } from "../engine/grade";
import { assemble } from "../asm/assemble";
import { MACHINES } from "../vm/types";
import { makeRng } from "../engine/rng";
import { AsmEditor, AsmErrors, AsmListing } from "./AsmEditor";
import { useMachine } from "./useMachine";
import { MachineView } from "./MachineView";
import { PALETTE } from "./palette";

/**
 * Phase-3 item types (§5.2): Parsons, trace-table, bug-hunt,
 * write-to-target, match, and the compiler view.
 *
 * Every graded component reports its FIRST submission via `onOutcome` —
 * that's the signal mastery and FSRS consume; later retries are practice.
 */

export interface StepProps<K extends Step["kind"]> {
  step: Extract<Step, { kind: K }>;
  onDone: () => void;
  onOutcome?: (correct: boolean) => void;
}

function NextButton({ onDone, label = "Next →" }: { onDone: () => void; label?: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={onDone}>{label}</button>
    </div>
  );
}

/** Call `report` once, on the first submission. */
function useFirstOutcome(onOutcome?: (correct: boolean) => void) {
  const [reported, setReported] = useState(false);
  return (correct: boolean) => {
    if (!reported) {
      setReported(true);
      onOutcome?.(correct);
    }
  };
}

// ------------------------------------------------------------- Parsons

export function ParsonsStep({ step, onDone, onOutcome }: StepProps<"parsons">) {
  const report = useFirstOutcome(onOutcome);
  // Deterministic shuffle per mount so a re-render doesn't reshuffle.
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const tray0 = useMemo(() => {
    const all = [...step.lines, ...(step.distractors ?? [])];
    const rng = makeRng(seed);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [step, seed]);

  const [tray, setTray] = useState<string[]>(tray0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [result, setResult] = useState<"none" | "pass" | "fail">("none");

  const pick = (i: number) => {
    setChosen([...chosen, tray[i]]);
    setTray(tray.filter((_, j) => j !== i));
    setResult("none");
  };
  const unpick = (i: number) => {
    setTray([...tray, chosen[i]]);
    setChosen(chosen.filter((_, j) => j !== i));
    setResult("none");
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= chosen.length) return;
    const next = [...chosen];
    [next[i], next[j]] = [next[j], next[i]];
    setChosen(next);
    setResult("none");
  };

  const submit = () => {
    const pass = gradeParsons(step.lines, chosen);
    report(pass);
    setResult(pass ? "pass" : "fail");
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <div className="row parsons">
        <div className="parsons-col">
          <h4>Pieces</h4>
          {tray.map((line, i) => (
            <button key={`${line}.${i}`} className="parsons-line" onClick={() => pick(i)}>
              {line}
            </button>
          ))}
          {tray.length === 0 && <p className="dim">(empty)</p>}
        </div>
        <div className="parsons-col">
          <h4>Your program</h4>
          {chosen.map((line, i) => (
            <div key={`${line}.${i}`} className="parsons-chosen">
              <button className="parsons-line" onClick={() => unpick(i)}>
                {line}
              </button>
              <button className="secondary mini" onClick={() => move(i, -1)} title="move up">↑</button>
              <button className="secondary mini" onClick={() => move(i, 1)} title="move down">↓</button>
            </div>
          ))}
          {chosen.length === 0 && <p className="dim">Click pieces to build the program here.</p>}
        </div>
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        <button onClick={submit} disabled={chosen.length === 0}>
          Check order
        </button>
        {result === "fail" && (
          <span className="feedback-bad">
            Not quite. Read your program from top to bottom — would BitBot do the right thing?
            {step.distractors?.length ? " (Watch out: some pieces don't belong at all.)" : ""}
          </span>
        )}
      </div>
      {result === "pass" && (
        <>
          <p className="feedback-good">That's the program! ✓</p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------- Trace table

export function TraceStep({ step, onDone, onOutcome }: StepProps<"trace">) {
  const report = useFirstOutcome(onOutcome);
  const expected = useMemo(
    () => traceExpected(step.sim, step.watchPC, step.columns, step.maxRows, step.maxSteps),
    [step]
  );
  const [cells, setCells] = useState<string[][]>(
    expected.map((row) => row.map(() => ""))
  );
  const [marks, setMarks] = useState<("" | "good" | "bad")[][]>(
    expected.map((row) => row.map(() => ""))
  );
  const [pass, setPass] = useState(false);

  const initial = useMemo(() => buildState(step.sim), [step]);
  const machine = useMachine(initial);

  const submit = () => {
    let all = true;
    const next = expected.map((row, r) =>
      row.map((want, c) => {
        const got = parseInt(cells[r][c], 10);
        const ok = got === want;
        all &&= ok;
        return ok ? ("good" as const) : ("bad" as const);
      })
    );
    setMarks(next);
    report(all);
    setPass(all);
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <MachineView machine={machine} controls highlights={[step.watchPC]} />
      <p className="dim">
        Each row is one visit to box {step.watchPC} (the top of the loop). Fill in what the
        machine holds at that moment. Step the machine above if you want to check yourself.
      </p>
      <table className="trace-table">
        <thead>
          <tr>
            <th>visit</th>
            {step.columns.map((c) => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expected.map((row, r) => (
            <tr key={r}>
              <td>{r + 1}</td>
              {row.map((_, c) => (
                <td key={c}>
                  <input
                    className={
                      "trace-cell" +
                      (marks[r][c] === "good" ? " cell-good" : marks[r][c] === "bad" ? " cell-bad" : "")
                    }
                    type="number"
                    value={cells[r][c]}
                    disabled={pass}
                    onChange={(e) => {
                      const next = cells.map((row2) => [...row2]);
                      next[r][c] = e.target.value;
                      setCells(next);
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ alignItems: "center" }}>
        {!pass && (
          <button onClick={submit} disabled={cells.some((r) => r.some((c) => c === ""))}>
            Check table
          </button>
        )}
        {!pass && marks.some((r) => r.includes("bad")) && (
          <span className="feedback-bad">The red cells aren't right yet — trace those visits again.</span>
        )}
      </div>
      {pass && (
        <>
          <p className="feedback-good">Whole table right! ✓</p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------ Target preview helper

/** Render the expected screen pixels of a target case as a mini screen. */
function TargetScreenGoal({ c, machine }: { c: TargetCase; machine: "bb8" | "bb16" }) {
  const cfg = MACHINES[machine];
  const cells = c.cells ?? {};
  const screenCells = Object.entries(cells).filter(
    ([a]) => Number(a) >= cfg.screenStart && Number(a) <= cfg.screenEnd
  );
  if (screenCells.length === 0) return null;
  const px = cfg.screenW <= 8 ? 18 : 7;
  return (
    <div>
      <p className="dim">Make the screen look like this:</p>
      <div
        className="screen-goal"
        style={{ gridTemplateColumns: `repeat(${cfg.screenW}, ${px}px)` }}
      >
        {Array.from({ length: cfg.screenW * cfg.screenH }, (_, i) => {
          const addr = cfg.screenStart + i;
          const color = cells[addr] ?? 0;
          return (
            <div
              key={i}
              style={{ width: px, height: px, background: PALETTE[color % PALETTE.length] }}
            />
          );
        })}
      </div>
    </div>
  );
}

function describeNonScreenGoal(c: TargetCase, machine: "bb8" | "bb16"): string[] {
  const cfg = MACHINES[machine];
  const out: string[] = [];
  if (c.A !== undefined) out.push(`A must end up holding ${c.A}.`);
  for (const [a, v] of Object.entries(c.cells ?? {})) {
    const addr = Number(a);
    if (addr < cfg.screenStart || addr > cfg.screenEnd) {
      out.push(`Box ${addr} must end up holding ${v}.`);
    }
  }
  return out;
}

// ------------------------------------------------------ Write-to-target

export function TargetStep({ step, onDone, onOutcome }: StepProps<"target">) {
  const report = useFirstOutcome(onOutcome);
  const machineKind = step.machine ?? "bb8";
  const [source, setSource] = useState(step.starter ?? "");
  const [result, setResult] = useState<ReturnType<typeof gradeTarget> | null>(null);

  const goalCase = step.check.cases[0];

  const submit = () => {
    const graded = gradeTarget(source, step.check, machineKind);
    report(graded.pass);
    setResult(graded);
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <TargetScreenGoal c={goalCase} machine={machineKind} />
      {describeNonScreenGoal(goalCase, machineKind).map((g) => (
        <p key={g} className="dim">
          🎯 {g}
        </p>
      ))}
      {step.check.cases.length > 1 && (
        <p className="dim">
          BitBot will test your program with {step.check.cases.length} different starting setups —
          it has to work for all of them, no hardcoding!
        </p>
      )}
      <AsmEditor value={source} onChange={(v) => { setSource(v); setResult(null); }} machine={machineKind} />
      <div className="row" style={{ alignItems: "center" }}>
        <button onClick={submit} disabled={source.trim() === ""}>
          Run all tests!
        </button>
        {result && !result.pass && result.asmErrors.length === 0 && (
          <span className="feedback-bad">
            It assembled and ran, but the end state wasn't right
            {result.failedCase !== null && step.check.cases.length > 1
              ? ` (setup ${result.failedCase + 1} failed)`
              : ""}
            . Look at what your program actually did below.
          </span>
        )}
      </div>
      {result && result.asmErrors.length > 0 && <AsmErrors errors={result.asmErrors} />}
      {result && !result.pass && result.finalState && (
        <FinalStateView state={result.finalState} />
      )}
      {result?.pass && (
        <>
          <p className="feedback-good">All tests pass — you wrote a real program! ✓</p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}

function FinalStateView({ state }: { state: import("../vm/types").VMState }) {
  const machine = useMachine(state);
  return (
    <div>
      <p className="dim">Where your program ended up:</p>
      <MachineView machine={machine} controls={false} />
    </div>
  );
}

// ------------------------------------------------------------ Bug hunt

export function BugHuntStep({ step, onDone, onOutcome }: StepProps<"bughunt">) {
  const report = useFirstOutcome(onOutcome);
  const machineKind = step.machine ?? "bb8";
  const [source, setSource] = useState(step.asm);
  const [result, setResult] = useState<ReturnType<typeof gradeTarget> | null>(null);

  const submit = () => {
    const graded = gradeTarget(source, step.check, machineKind);
    report(graded.pass);
    setResult(graded);
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <p className="dim">This program has exactly one bug. Find it, fix it, and run the tests.</p>
      <AsmEditor value={source} onChange={(v) => { setSource(v); setResult(null); }} machine={machineKind} />
      <div className="row" style={{ alignItems: "center" }}>
        <button onClick={submit}>Run the tests</button>
        {result && !result.pass && result.asmErrors.length === 0 && (
          <span className="feedback-bad">Still buggy. Trace it line by line — what does it DO, not what should it do?</span>
        )}
      </div>
      {result && result.asmErrors.length > 0 && <AsmErrors errors={result.asmErrors} />}
      {result?.pass && (
        <>
          <p className="feedback-good">Bug squashed! ✓</p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------- Match

export function MatchStep({ step, onDone, onOutcome }: StepProps<"match">) {
  const report = useFirstOutcome(onOutcome);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const rights = useMemo(() => {
    const r = step.pairs.map((p) => p.right);
    const rng = makeRng(seed);
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }, [step, seed]);
  const [picks, setPicks] = useState<number[]>(step.pairs.map(() => -1));
  const [result, setResult] = useState<"none" | "pass" | "fail">("none");

  const submit = () => {
    const pass = step.pairs.every((p, i) => rights[picks[i]] === p.right);
    report(pass);
    setResult(pass ? "pass" : "fail");
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <table className="match-table">
        <tbody>
          {step.pairs.map((p, i) => (
            <tr key={i}>
              <td>
                <code className="c-code">{p.left}</code>
              </td>
              <td>=</td>
              <td>
                <select
                  value={picks[i]}
                  onChange={(e) => {
                    const next = [...picks];
                    next[i] = Number(e.target.value);
                    setPicks(next);
                    setResult("none");
                  }}
                >
                  <option value={-1} disabled>
                    pick the assembly…
                  </option>
                  {rights.map((r, j) => (
                    <option key={j} value={j}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ alignItems: "center" }}>
        <button onClick={submit} disabled={picks.includes(-1)}>
          Check matches
        </button>
        {result === "fail" && (
          <span className="feedback-bad">Some pairs are crossed — think about what each C line DOES to memory.</span>
        )}
      </div>
      {result === "pass" && (
        <>
          <p className="feedback-good">All matched! C is shorthand for what you already write. ✓</p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------- Compiler view

export function CViewStep({ step, onDone }: StepProps<"cview">) {
  const machineKind = step.machine ?? "bb8";
  const assembled = useMemo(() => assemble(step.asm, machineKind), [step, machineKind]);
  const initial = useMemo(() => {
    const st = buildState({
      machine: machineKind,
      program: assembled.result?.bytes ?? [],
      memory: step.memory,
    });
    return st;
  }, [step, assembled, machineKind]);
  const machine = useMachine(initial);

  const asmLine = assembled.result?.addrToLine[machine.state.PC];
  const cLine = asmLine !== undefined ? step.lineMap[asmLine] : undefined;

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <div className="row cview">
        <div className="cview-pane">
          <h4>C</h4>
          <pre className="c-listing">
            {step.c.map((line, i) => (
              <div key={i} className={i === cLine ? "asm-active" : undefined}>
                {line || " "}
              </div>
            ))}
          </pre>
        </div>
        <div className="cview-pane">
          <h4>BitBot assembly</h4>
          <AsmListing source={step.asm} activeLine={asmLine} />
        </div>
      </div>
      <MachineView machine={machine} controls />
      <NextButton onDone={onDone} />
    </div>
  );
}
