import { useMemo, useState } from "react";
import {
  answerProbe,
  currentProbe,
  grantedSkills,
  PLACEMENT_RUNGS,
  PlacementState,
  startPlacement,
} from "../engine/placement";
import { SKILLS } from "../content/skills";
import { recordAttempt, seedMastered } from "../engine/mastery";
import { BitToggles } from "./BitToggles";

interface Props {
  profileId: string;
  onFinish: (grantedCount: number) => void;
}

/**
 * Placement diagnostic (§5.4): a short adaptive probe at profile creation.
 * Clearing a rung grants every skill below the next rung's unit, so a
 * student with prior experience starts where the questions got hard.
 */
export function Placement({ profileId, onFinish }: Props) {
  const [state, setState] = useState<PlacementState>(startPlacement);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9) || 1);
  const [typed, setTyped] = useState("");
  const [bits, setBits] = useState(0);
  const [asked, setAsked] = useState(0);

  const probe = useMemo(
    () => (state.finished ? null : currentProbe(state, seed)),
    [state, seed]
  );

  const finish = (s: PlacementState) => {
    const granted = grantedSkills(s, SKILLS);
    if (granted.length > 0) seedMastered(profileId, granted);
    onFinish(granted.length);
  };

  if (state.finished || !probe) {
    finish(state);
    return null;
  }

  const submit = () => {
    const answer = probe.mode === "bits" ? bits : parseInt(typed, 10);
    const correct = answer === probe.answer;
    recordAttempt(profileId, {
      skillId: `placement.${PLACEMENT_RUNGS[state.rung].label}`,
      itemKind: "drill",
      correct,
      latencyMs: 0,
      at: new Date().toISOString(),
      context: "placement",
    });
    const next = answerProbe(state, correct);
    setTyped("");
    setBits(0);
    setSeed(Math.floor(Math.random() * 1e9) || 1);
    setAsked(asked + 1);
    if (next.finished) {
      finish(next);
    } else {
      setState(next);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 560, margin: "40px auto" }}>
      <h2>Quick check-in</h2>
      <p className="dim">
        A few questions to find your starting point. Not sure? Just guess — wrong answers only
        mean you'll start earlier, and that's fine.
      </p>
      <p className="dim">
        Topic: <b>{PLACEMENT_RUNGS[state.rung].label}</b> (question {asked + 1})
      </p>
      <p className="big">{probe.prompt}</p>
      {probe.mode === "bits" ? (
        <div className="col">
          <BitToggles bitCount={probe.bitCount} value={bits} onChange={setBits} />
          <div>
            <button onClick={submit}>Answer</button>
            <button className="secondary" style={{ marginLeft: 8 }} onClick={() => finish(state)}>
              Skip — start from the beginning
            </button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ alignItems: "center" }}>
          <input
            type="number"
            value={typed}
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && typed !== "" && submit()}
          />
          <button onClick={submit} disabled={typed === ""}>
            Answer
          </button>
          <button className="secondary" onClick={() => finish(state)}>
            Skip — start from the beginning
          </button>
        </div>
      )}
    </div>
  );
}
