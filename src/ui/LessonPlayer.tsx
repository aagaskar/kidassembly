import { useEffect, useMemo, useRef, useState } from "react";
import { Lesson, Step, isBlank } from "../engine/types";
import {
  buildState,
  expectedPrediction,
  gradeFillBlank,
  makeDrillQuestion,
} from "../engine/grade";
import { markComplete } from "../engine/profiles";
import { OP_INFO } from "../vm/decode";
import { useMachine } from "./useMachine";
import { MachineView } from "./MachineView";
import { BitsExercise, BitToggles } from "./BitToggles";

interface Props {
  lesson: Lesson;
  profileId: string;
  onExit: () => void;
}

export function LessonPlayer({ lesson, profileId, onExit }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  const advance = () => {
    if (stepIndex + 1 < lesson.steps.length) {
      setStepIndex(stepIndex + 1);
    } else {
      markComplete(profileId, lesson.id);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="panel" style={{ textAlign: "center" }}>
        <h2>🎉 Lesson complete!</h2>
        <p className="big">{lesson.title} — done.</p>
        <button onClick={onExit}>Back to lessons</button>
      </div>
    );
  }

  const step = lesson.steps[stepIndex];
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>{lesson.title}</h2>
        <button className="secondary" onClick={onExit}>
          ✕ Exit
        </button>
      </div>
      <div className="progressbar">
        <div style={{ width: `${(stepIndex / lesson.steps.length) * 100}%` }} />
      </div>
      {/* key forces a clean remount per step so per-step state never leaks */}
      <StepView key={`${lesson.id}.${stepIndex}`} step={step} onDone={advance} />
    </div>
  );
}

function NextButton({ onDone, label = "Next →" }: { onDone: () => void; label?: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={onDone}>{label}</button>
    </div>
  );
}

function StepView({ step, onDone }: { step: Step; onDone: () => void }) {
  switch (step.kind) {
    case "info":
      return <InfoStep step={step} onDone={onDone} />;
    case "bits":
      return <BitsStep step={step} onDone={onDone} />;
    case "drill":
      return <DrillStep step={step} onDone={onDone} />;
    case "quiz":
      return <QuizStep step={step} onDone={onDone} />;
    case "predict":
      return <PredictStep step={step} onDone={onDone} />;
    case "fillblank":
      return <FillBlankStep step={step} onDone={onDone} />;
  }
}

function InfoStep({ step, onDone }: { step: Extract<Step, { kind: "info" }>; onDone: () => void }) {
  const initial = useMemo(() => buildState(step.sim ?? {}), [step]);
  const machine = useMachine(initial);
  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      {step.sim && (
        <MachineView machine={machine} highlights={step.highlight} controls={false} />
      )}
      <NextButton onDone={onDone} />
    </div>
  );
}

function BitsStep({ step, onDone }: { step: Extract<Step, { kind: "bits" }>; onDone: () => void }) {
  const [value, setValue] = useState(0);
  const hit = value === step.target;
  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <BitsExercise bitCount={step.bitCount} onValue={setValue} />
      {hit ? (
        <>
          <p className="feedback-good">That's it! {step.target} ✓</p>
          <NextButton onDone={onDone} />
        </>
      ) : (
        <p className="dim">Click the lamps to flip them.</p>
      )}
    </div>
  );
}

function DrillStep({ step, onDone }: { step: Extract<Step, { kind: "drill" }>; onDone: () => void }) {
  // Fresh seed per mount: drills are parameterized and never repeat verbatim.
  const baseSeed = useRef(Math.floor(Math.random() * 0x7fffffff) || 1);
  const [solved, setSolved] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState("");
  const [bits, setBits] = useState(0);
  const [wrong, setWrong] = useState(false);

  const q = useMemo(
    () => makeDrillQuestion(step.drill, baseSeed.current + solved * 131 + attempt * 7919, step.maxValue ?? 15),
    [step, solved, attempt]
  );

  if (solved >= step.count) {
    return (
      <div className="panel">
        <p className="feedback-good">
          Drill done — {step.count} in a row! ✓
        </p>
        <NextButton onDone={onDone} />
      </div>
    );
  }

  const submit = () => {
    const answer = q.mode === "type" ? parseInt(typed, 10) : bits;
    if (answer === q.answer) {
      setSolved(solved + 1);
      setWrong(false);
    } else {
      setAttempt(attempt + 1); // new question, no answer reveal
      setWrong(true);
    }
    setTyped("");
    setBits(0);
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <p className="dim">
        Question {solved + 1} of {step.count}
      </p>
      <p className="big">{q.prompt}</p>
      {q.mode === "type" ? (
        <div className="row" style={{ alignItems: "center" }}>
          <input
            type="number"
            value={typed}
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && typed !== "" && submit()}
          />
          <button onClick={submit} disabled={typed === ""}>
            Check
          </button>
        </div>
      ) : (
        <div className="col">
          <BitToggles bitCount={q.bitCount} value={bits} onChange={setBits} />
          <div>
            <button onClick={submit}>Check</button>
          </div>
        </div>
      )}
      {wrong && <p className="feedback-bad">Not quite — here's a different one. You've got this!</p>}
    </div>
  );
}

function QuizStep({ step, onDone }: { step: Extract<Step, { kind: "quiz" }>; onDone: () => void }) {
  const initial = useMemo(() => buildState(step.sim ?? {}), [step]);
  const machine = useMachine(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === step.answer;

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      {step.sim && (
        <MachineView machine={machine} highlights={step.highlight} controls={false} />
      )}
      <div>
        {step.choices.map((choice, i) => (
          <button
            key={i}
            className={
              "choice" +
              (picked === i ? (i === step.answer ? " picked-good" : " picked-bad") : "")
            }
            disabled={correct}
            onClick={() => setPicked(i)}
          >
            {choice}
          </button>
        ))}
      </div>
      {picked !== null && !correct && (
        <p className="feedback-bad">Hmm, look again — try another answer.</p>
      )}
      {correct && (
        <>
          <p className="feedback-good">Right! ✓</p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}

function PredictStep({ step, onDone }: { step: Extract<Step, { kind: "predict" }>; onDone: () => void }) {
  const initial = useMemo(() => buildState(step.sim), [step]);
  const machine = useMachine(initial);
  const [typed, setTyped] = useState("");
  const [tries, setTries] = useState(0);
  const [phase, setPhase] = useState<"asking" | "animating" | "shown">("asking");
  const [gotIt, setGotIt] = useState(false);

  const expected = useMemo(
    () => expectedPrediction(step.sim, step.stepsToRun, step.ask),
    [step]
  );

  const askLabel =
    step.ask.what === "A" ? "A" : step.ask.what === "PC" ? "PC" : `box ${step.ask.addr}`;

  // After the answer, animate the machine through the steps so the student
  // SEES the state change they predicted (prediction-first stepping, §5.1).
  useEffect(() => {
    if (phase !== "animating") return;
    if (machine.state.steps >= step.stepsToRun || machine.state.halted) {
      setPhase("shown");
      return;
    }
    const id = setTimeout(machine.doStep, 700);
    return () => clearTimeout(id);
  }, [phase, machine.state, step.stepsToRun, machine.doStep]);

  const submit = () => {
    const answer = parseInt(typed, 10);
    if (answer === expected) {
      setGotIt(true);
      setPhase(step.stepsToRun > 0 ? "animating" : "shown");
    } else if (tries + 1 >= 2) {
      setGotIt(false);
      setPhase(step.stepsToRun > 0 ? "animating" : "shown");
    } else {
      setTries(tries + 1);
      setTyped("");
    }
  };

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <MachineView machine={machine} controls={false} highlights={
        step.ask.what === "cell" ? [step.ask.addr] : undefined
      } />
      {phase === "asking" && (
        <div className="row" style={{ alignItems: "center", marginTop: 10 }}>
          <span className="big">
            Your prediction for <b>{askLabel}</b>:
          </span>
          <input
            type="number"
            value={typed}
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && typed !== "" && submit()}
          />
          <button onClick={submit} disabled={typed === ""}>
            Lock it in
          </button>
          {tries > 0 && (
            <span className="feedback-bad">Not that — trace it one step at a time.</span>
          )}
        </div>
      )}
      {phase === "animating" && <p className="dim">Watch BitBot do it…</p>}
      {phase === "shown" && (
        <>
          <p className={gotIt ? "feedback-good" : "feedback-bad"}>
            {gotIt
              ? `Predicted it! ${askLabel} = ${expected} ✓`
              : `The answer was ${expected}. Watch how it got there — then the next one is yours.`}
          </p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}

function FillBlankStep({ step, onDone }: { step: Extract<Step, { kind: "fillblank" }>; onDone: () => void }) {
  const blanks = step.program.filter(isBlank);
  const [answers, setAnswers] = useState<string[]>(blanks.map(() => ""));
  const [result, setResult] = useState<"none" | "pass" | "fail">("none");

  const submit = () => {
    const nums = answers.map((a) => parseInt(a, 10));
    if (nums.some(Number.isNaN)) return;
    const graded = gradeFillBlank(step.program, step.check, nums);
    setResult(graded.pass ? "pass" : "fail");
  };

  // Render byte pairs as instruction tiles with mnemonic labels.
  const tiles: JSX.Element[] = [];
  let blankIndex = 0;
  for (let i = 0; i < step.program.length; i += 2) {
    const opByte = step.program[i];
    const operand = step.program[i + 1];
    const opLabel = !isBlank(opByte) ? OP_INFO[opByte]?.mnemonic ?? "?" : "?";
    const renderCell = (cell: typeof opByte, label: string) => {
      if (isBlank(cell)) {
        const idx = blankIndex++;
        return (
          <div className="prog-tile" key={`${i}.${label}`}>
            <span className="label">{cell.hint ?? "?"}</span>
            <input
              className="blank-input"
              type="number"
              value={answers[idx]}
              onChange={(e) => {
                const next = [...answers];
                next[idx] = e.target.value;
                setAnswers(next);
                setResult("none");
              }}
            />
          </div>
        );
      }
      return (
        <div className="prog-tile" key={`${i}.${label}`}>
          <span className="label">{label}</span>
          <span className="byte">{cell}</span>
        </div>
      );
    };
    tiles.push(renderCell(opByte, opLabel));
    if (operand !== undefined) {
      tiles.push(renderCell(operand, isBlank(opByte) ? "number" : "with"));
    }
  }

  return (
    <div className="panel">
      <p className="big">{step.text}</p>
      <div>{tiles}</div>
      <div className="row" style={{ alignItems: "center", marginTop: 10 }}>
        <button onClick={submit} disabled={answers.some((a) => a === "")}>
          Run it!
        </button>
        {result === "fail" && (
          <span className="feedback-bad">
            BitBot ran it… but memory didn't end up right. Check each blank and run again.
          </span>
        )}
      </div>
      {result === "pass" && (
        <>
          <p className="feedback-good">It works! ✓</p>
          {step.explain && <p>{step.explain}</p>}
          <NextButton onDone={onDone} />
        </>
      )}
    </div>
  );
}
