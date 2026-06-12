import { Lesson } from "../engine/types";
import { Profile } from "../engine/profiles";

const UNIT_NAMES: Record<number, string> = {
  0: "Unit 0 — Bits and representation",
  1: "Unit 1 — Memory: boxes with addresses",
  2: "Unit 2 — The machine wakes up",
};

interface Props {
  lessons: Lesson[];
  completed: Set<string>;
  profile: Profile;
  onSwitchProfile: () => void;
  onOpenLesson: (id: string) => void;
  onOpenPlayground: () => void;
}

export function Home({
  lessons,
  completed,
  profile,
  onSwitchProfile,
  onOpenLesson,
  onOpenPlayground,
}: Props) {
  // Sequential gating: a lesson unlocks when everything before it is done.
  // (The full prerequisite-graph engine replaces this in Phase 2.)
  let locked = false;
  const rows = lessons.map((lesson) => {
    const isDone = completed.has(lesson.id);
    const isLocked = locked;
    if (!isDone) locked = true;
    return { lesson, isDone, isLocked };
  });

  const units = [...new Set(lessons.map((l) => l.unit))];

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>🤖 BitBot</h1>
        <div className="row" style={{ alignItems: "center" }}>
          <button className="secondary" title="switch profile" onClick={onSwitchProfile}>
            {profile.avatar} {profile.name} ⇄
          </button>
          <button onClick={onOpenPlayground}>🛠 Playground</button>
        </div>
      </div>
      <p className="dim">Learn how a computer REALLY works — one tiny step at a time.</p>
      {units.map((unit) => (
        <div className="panel" key={unit}>
          <h3>{UNIT_NAMES[unit] ?? `Unit ${unit}`}</h3>
          {rows
            .filter((r) => r.lesson.unit === unit)
            .map(({ lesson, isDone, isLocked }) => (
              <div key={lesson.id} className={"lesson-card" + (isLocked ? " locked" : "")}>
                <div>
                  <b>{lesson.title}</b>
                  <div className="dim">{lesson.summary}</div>
                </div>
                {isDone ? (
                  <span className="feedback-good">✓ done</span>
                ) : (
                  <button disabled={isLocked} onClick={() => onOpenLesson(lesson.id)}>
                    {isLocked ? "🔒" : "Start"}
                  </button>
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
