import { Lesson } from "../engine/types";
import { Profile } from "../engine/profiles";
import { SKILLS } from "../content/skills";
import { dueSkills, getXP, loadSkillStates, masteryOf } from "../engine/mastery";

const UNIT_NAMES: Record<number, string> = {
  0: "Unit 0 — Bits and representation",
  1: "Unit 1 — Memory: boxes with addresses",
  2: "Unit 2 — The machine wakes up",
  3: "Unit 3 — Arithmetic and first pixels",
  4: "Unit 4 — The assembler: names for numbers",
  5: "Unit 5 — Going in circles: jumps and loops",
  6: "Unit 6 — Arrows: indirect addressing",
  7: "Unit 7 — Reusable code: CALL, RET, the stack",
  8: "Unit 8 — The bridge: inventing a language",
  9: "Unit 9 — MiniC: variables and types",
  10: "Unit 10 — Control flow in C",
  11: "Unit 11 — Functions",
  12: "Unit 12 — Pointers in C (the payoff)",
  13: "Unit 13 — Arrays and strings",
  14: "Unit 14 — Structs and memory layout",
  15: "Unit 15 — Capstone: games and real C",
};

interface Props {
  lessons: Lesson[];
  completed: Set<string>;
  profile: Profile;
  onSwitchProfile: () => void;
  onOpenLesson: (id: string) => void;
  onOpenPlayground: () => void;
  onOpenReview: () => void;
  onOpenDashboard: () => void;
}

export function Home({
  lessons,
  completed,
  profile,
  onSwitchProfile,
  onOpenLesson,
  onOpenPlayground,
  onOpenReview,
  onOpenDashboard,
}: Props) {
  // Phase-2 gating: a lesson unlocks when its skill's prereqs are mastered.
  const states = loadSkillStates(profile.id);
  const due = dueSkills(profile.id, SKILLS).length;
  const xp = getXP(profile.id);

  const isDebug = profile.name === "debug";

  const rows = lessons.map((lesson) => {
    const skill = SKILLS.find((s) => s.id === lesson.id);
    const mastery = skill ? masteryOf(skill, states) : "learning";
    return {
      lesson,
      isDone: completed.has(lesson.id),
      isLocked: isDebug ? false : mastery === "locked",
      relearning: mastery === "relearning",
    };
  });

  const units = [...new Set(lessons.map((l) => l.unit))];

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1>🤖 BitBot</h1>
        <div className="row" style={{ alignItems: "center" }}>
          <span className="xp" title="XP from mastered skills and finished reviews">
            ⭐ {xp}
          </span>
          <button className="secondary" title="switch profile" onClick={onSwitchProfile}>
            {profile.avatar} {profile.name} ⇄
          </button>
          <button className="secondary" onClick={onOpenDashboard} title="for grown-ups">
            📊
          </button>
          <button onClick={onOpenPlayground}>🛠 Playground</button>
        </div>
      </div>
      <p className="dim">Learn how a computer REALLY works — one tiny step at a time.</p>

      <div className="panel review-banner">
        <div>
          <b>🔁 Daily review</b>
          <div className="dim">
            {due === 0
              ? "Nothing due — your skills are fresh."
              : `${due} skill${due === 1 ? "" : "s"} ready for a quick workout.`}
          </div>
        </div>
        <button onClick={onOpenReview} disabled={due === 0}>
          {due === 0 ? "All done ✓" : "Review now"}
        </button>
      </div>

      {units.map((unit) => (
        <div className="panel" key={unit}>
          <h3>{UNIT_NAMES[unit] ?? `Unit ${unit}`}</h3>
          {rows
            .filter((r) => r.lesson.unit === unit)
            .map(({ lesson, isDone, isLocked, relearning }) => (
              <div key={lesson.id} className={"lesson-card" + (isLocked ? " locked" : "")}>
                <div>
                  <b>{lesson.title}</b>
                  <div className="dim">{lesson.summary}</div>
                </div>
                {isDone ? (
                  <div className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                    <span className="feedback-good">
                      {relearning ? "↻ in review" : "✓ done"}
                    </span>
                    <button className="secondary" onClick={() => onOpenLesson(lesson.id)}>
                      Redo
                    </button>
                  </div>
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
