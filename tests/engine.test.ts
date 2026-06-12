import { beforeEach, describe, expect, it } from "vitest";
import { makeMemoryStorage, setStorageBackend } from "../src/engine/storage";
import {
  initialFsrs,
  intervalForStability,
  isDue,
  retrievability,
  reviewFsrs,
} from "../src/engine/fsrs";
import { checkGraph, Skill } from "../src/engine/skills";
import {
  composeReviewSession,
  dueSkills,
  getXP,
  loadSkillStates,
  masteryOf,
  recordReviewOutcome,
  recordSkillMastered,
  seedMastered,
} from "../src/engine/mastery";
import {
  answerProbe,
  grantedSkills,
  PLACEMENT_RUNGS,
  startPlacement,
} from "../src/engine/placement";

beforeEach(() => {
  setStorageBackend(makeMemoryStorage());
});

const DAY = 24 * 60 * 60 * 1000;

function mkSkill(id: string, unit: number, over: Partial<Skill> = {}): Skill {
  return {
    id,
    unit,
    title: id,
    prereqs: [],
    subsumes: [],
    automaticity: false,
    relearnRule: 2,
    makeReviewItem: () => ({ kind: "info", text: "stub" }),
    ...over,
  };
}

describe("FSRS scheduler", () => {
  it("intervals expand under repeated success", () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    let s = initialFsrs(t0);
    const intervals: number[] = [];
    let now = t0;
    for (let i = 0; i < 8; i++) {
      now = new Date(s.due); // review exactly on time
      s = reviewFsrs(s, "good", now);
      intervals.push(intervalForStability(s.stability));
    }
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
    // Sane schedule shape: after 8 perfect reviews, interval is weeks–months,
    // not hours and not years.
    expect(intervals[7]).toBeGreaterThan(14);
    expect(intervals[7]).toBeLessThan(400);
  });

  it("failure collapses the interval and raises difficulty", () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    let s = initialFsrs(t0);
    for (let i = 0; i < 4; i++) s = reviewFsrs(s, "good", new Date(s.due));
    const before = s.stability;
    const failed = reviewFsrs(s, "again", new Date(s.due));
    expect(failed.stability).toBeLessThan(before / 2);
    expect(failed.difficulty).toBeGreaterThan(s.difficulty);
  });

  it("retrievability decays with time and matches the retention target", () => {
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(10, 10)).toBeLessThan(retrievability(1, 10));
    // At the scheduled interval, recall should be at the requested retention.
    const r = retrievability(intervalForStability(10), 10);
    expect(r).toBeCloseTo(0.9, 5);
  });
});

describe("mastery and the skill graph", () => {
  it("locks skills behind prereqs and unlocks on mastery", () => {
    const a = mkSkill("a", 0);
    const b = mkSkill("b", 0, { prereqs: ["a"] });
    const states = loadSkillStates("p1");
    expect(masteryOf(a, states)).toBe("learning");
    expect(masteryOf(b, states)).toBe("locked");

    recordSkillMastered("p1", a);
    const after = loadSkillStates("p1");
    expect(masteryOf(a, after)).toBe("mastered");
    expect(masteryOf(b, after)).toBe("learning");
  });

  it("failure demotes to relearning; consecutive successes restore mastery", () => {
    const a = mkSkill("a", 0);
    const now = new Date("2026-01-01T00:00:00Z");
    recordSkillMastered("p1", a, now);

    recordReviewOutcome("p1", a, [a], false, new Date(now.getTime() + DAY));
    expect(loadSkillStates("p1").get("a")!.mastery).toBe("relearning");

    recordReviewOutcome("p1", a, [a], true, new Date(now.getTime() + 2 * DAY));
    expect(loadSkillStates("p1").get("a")!.mastery).toBe("relearning");
    recordReviewOutcome("p1", a, [a], true, new Date(now.getTime() + 3 * DAY));
    expect(loadSkillStates("p1").get("a")!.mastery).toBe("mastered");
  });

  it("XP is awarded for mastery events only — re-completing gives nothing", () => {
    const a = mkSkill("a", 0);
    recordSkillMastered("p1", a);
    const xp = getXP("p1");
    expect(xp).toBeGreaterThan(0);
    recordSkillMastered("p1", a);
    expect(getXP("p1")).toBe(xp);
  });

  it("graph checker catches dangling edges and cycles", () => {
    expect(checkGraph([mkSkill("a", 0, { prereqs: ["ghost"] })])).toHaveLength(1);
    const x = mkSkill("x", 0, { prereqs: ["y"] });
    const y = mkSkill("y", 0, { prereqs: ["x"] });
    expect(checkGraph([x, y]).join()).toMatch(/cycle/);
    expect(checkGraph([mkSkill("a", 0), mkSkill("b", 0, { prereqs: ["a"] })])).toEqual([]);
  });
});

describe("layering credit keeps review volume bounded (§5.4 acceptance)", () => {
  it("a chain of subsuming skills: practicing the top keeps the bottom fresh", () => {
    // u05 loop subsumes u02 step subsumes u01 boxes.
    const boxes = mkSkill("boxes", 1);
    const step = mkSkill("step", 2, { subsumes: ["boxes"] });
    const loop = mkSkill("loop", 5, { subsumes: ["step"] });
    const all = [boxes, step, loop];
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (const s of all) recordSkillMastered("p1", s, t0);

    // Simulate 60 days of a student who only ever reviews `loop` on time.
    let now = t0;
    for (let day = 1; day <= 60; day++) {
      now = new Date(t0.getTime() + day * DAY);
      const due = dueSkills("p1", [loop], now);
      if (due.length > 0) recordReviewOutcome("p1", loop, all, true, now);
    }

    // Transitive layering credit must have refreshed the subsumed skills:
    // neither `step` nor `boxes` should be drowning in overdueness.
    const states = loadSkillStates("p1");
    expect(new Date(states.get("step")!.fsrs!.due).getTime()).toBeGreaterThan(
      t0.getTime() + 30 * DAY
    );
    expect(new Date(states.get("boxes")!.fsrs!.due).getTime()).toBeGreaterThan(
      t0.getTime() + 30 * DAY
    );
  });

  it("simulated student: total review load stays bounded as the graph grows", () => {
    // 30 skills in a subsumption chain, mastered one per day; the student
    // does their due reviews every day and always answers correctly.
    const skills: Skill[] = [];
    for (let i = 0; i < 30; i++) {
      skills.push(mkSkill(`s${i}`, Math.floor(i / 4), { subsumes: i > 0 ? [`s${i - 1}`] : [] }));
    }
    const t0 = new Date("2026-01-01T00:00:00Z");
    let totalReviews = 0;
    let maxPerDay = 0;
    for (let day = 0; day < 120; day++) {
      const now = new Date(t0.getTime() + day * DAY);
      if (day < 30) recordSkillMastered("p1", skills[day], now);
      const due = dueSkills("p1", skills, now);
      maxPerDay = Math.max(maxPerDay, due.length);
      for (const s of due.slice(0, 20)) {
        recordReviewOutcome("p1", s, skills, true, now);
        totalReviews++;
      }
    }
    // Without layering credit 30 skills × expanding reviews over 120 days
    // would far exceed this; with credit the load stays small.
    expect(totalReviews).toBeLessThan(150);
    expect(maxPerDay).toBeLessThanOrEqual(20);
  });

  it("review session interleaves units", () => {
    const skills = [
      mkSkill("a1", 1),
      mkSkill("a2", 1),
      mkSkill("b1", 2),
      mkSkill("b2", 2),
    ];
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (const s of skills) recordSkillMastered("p1", s, t0);
    const later = new Date(t0.getTime() + 30 * DAY);
    const session = composeReviewSession("p1", skills, later, 4);
    expect(session).toHaveLength(4);
    for (let i = 1; i < session.length; i++) {
      expect(session[i].unit).not.toBe(session[i - 1].unit);
    }
  });
});

describe("placement diagnostic", () => {
  const skills = [
    mkSkill("u0a", 0),
    mkSkill("u0b", 0),
    mkSkill("u1a", 1),
    mkSkill("u2a", 2),
    mkSkill("u5a", 5),
    mkSkill("u6a", 6),
  ];

  it("a miss on the first rung grants nothing", () => {
    let s = startPlacement();
    s = answerProbe(s, false);
    expect(s.finished).toBe(true);
    expect(grantedSkills(s, skills)).toEqual([]);
  });

  it("clearing the binary rung grants unit 0", () => {
    let s = startPlacement();
    s = answerProbe(s, true);
    s = answerProbe(s, true); // rung 0 cleared
    s = answerProbe(s, false); // miss rung 1
    expect(s.finished).toBe(true);
    expect(grantedSkills(s, skills)).toEqual(["u0a", "u0b"]);
  });

  it("clearing every rung grants everything below the last rung's unit + 1", () => {
    let s = startPlacement();
    for (let i = 0; i < PLACEMENT_RUNGS.length * 2; i++) s = answerProbe(s, true);
    expect(s.finished).toBe(true);
    expect(grantedSkills(s, skills)).toEqual(["u0a", "u0b", "u1a", "u2a", "u5a", "u6a"]);
  });

  it("granted skills are seeded mastered and due in the future", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    seedMastered("p1", ["u0a", "u0b"], now);
    const states = loadSkillStates("p1");
    expect(states.get("u0a")!.mastery).toBe("mastered");
    expect(isDue(states.get("u0a")!.fsrs as never, now)).toBe(false);
  });
});
