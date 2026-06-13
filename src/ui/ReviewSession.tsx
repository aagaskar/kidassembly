import { useMemo, useRef, useState } from "react";
import { Skill } from "../engine/skills";
import { SKILLS } from "../content/skills";
import {
  addXP,
  composeReviewSession,
  recordAttempt,
  recordReviewOutcome,
} from "../engine/mastery";
import { StepView } from "./LessonPlayer";

interface Props {
  profileId: string;
  onExit: () => void;
}

/**
 * Daily review (§5.4): due skills, interleaved across units, one
 * parameterized item each. First-try outcomes feed FSRS and layering
 * credit; finishing the session is an XP event (§5.5).
 */
export function ReviewSession({ profileId, onExit }: Props) {
  const session = useMemo(() => composeReviewSession(profileId, SKILLS), [profileId]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const outcomeRef = useRef<boolean | null>(null);
  const startedRef = useRef(Date.now());

  if (session.length === 0) {
    return (
      <div className="panel" style={{ textAlign: "center" }}>
        <h2>Nothing due! 🎉</h2>
        <p className="big">Your skills are all fresh. Come back tomorrow, or learn something new.</p>
        <button onClick={onExit}>Back home</button>
      </div>
    );
  }

  if (index >= session.length) {
    const right = results.filter(Boolean).length;
    return (
      <div className="panel" style={{ textAlign: "center" }}>
        <h2>Review done! ✓</h2>
        <p className="big">
          {right} of {results.length} on the first try. +10 XP for finishing.
        </p>
        <button onClick={onExit}>Back home</button>
      </div>
    );
  }

  const skill: Skill = session[index];
  const item = skill.makeReviewItem!(Math.floor(Math.random() * 1e9));

  const onOutcome = (correct: boolean) => {
    outcomeRef.current = correct;
    recordAttempt(profileId, {
      skillId: skill.id,
      itemKind: item.kind,
      correct,
      latencyMs: Date.now() - startedRef.current,
      at: new Date().toISOString(),
      context: "review",
    });
  };

  const advance = () => {
    // No grading signal (info-ish step)? Count completion as success.
    const correct = outcomeRef.current ?? true;
    recordReviewOutcome(profileId, skill, SKILLS, correct);
    setResults([...results, correct]);
    outcomeRef.current = null;
    startedRef.current = Date.now();
    if (index + 1 >= session.length) addXP(profileId, 10); // completed session
    setIndex(index + 1);
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>🔁 Daily review</h2>
        <button className="secondary" onClick={onExit}>
          ✕ Exit
        </button>
      </div>
      <p className="dim">
        Item {index + 1} of {session.length} — keeping <b>{skill.title}</b> fresh.
      </p>
      <div className="progressbar">
        <div style={{ width: `${(index / session.length) * 100}%` }} />
      </div>
      <StepView
        key={`${skill.id}.${index}`}
        step={item}
        profileId={profileId}
        onDone={advance}
        onOutcome={onOutcome}
      />
    </div>
  );
}
