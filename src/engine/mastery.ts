import { readJSON, writeJSON } from "./storage";
import { Attempt, Mastery, Skill, StudentSkillState } from "./skills";
import { FsrsState, initialFsrs, isDue, layeredCredit, reviewFsrs } from "./fsrs";

/**
 * Per-profile mastery + scheduling store (§5.4). All state is client-side;
 * everything here reads/writes the swappable storage backend.
 */

const skillsKey = (profileId: string) => `kidassembly.skills.v1.${profileId}`;
const telemetryKey = (profileId: string) => `kidassembly.telemetry.v1.${profileId}`;
const xpKey = (profileId: string) => `kidassembly.xp.v1.${profileId}`;

const TELEMETRY_CAP = 5000;

interface SkillsData {
  states: StudentSkillState[];
}

export function loadSkillStates(profileId: string): Map<string, StudentSkillState> {
  const data = readJSON<SkillsData>(skillsKey(profileId));
  return new Map((data?.states ?? []).map((s) => [s.skillId, s]));
}

function saveSkillStates(profileId: string, states: Map<string, StudentSkillState>): void {
  writeJSON(skillsKey(profileId), { states: [...states.values()] });
}

export function replaceSkillStates(profileId: string, states: StudentSkillState[]): void {
  writeJSON(skillsKey(profileId), { states });
}

/** Effective mastery, deriving "locked"/"learning" from the graph. */
export function masteryOf(
  skill: Skill,
  states: Map<string, StudentSkillState>
): Mastery {
  const stored = states.get(skill.id);
  if (stored) return stored.mastery;
  const unlocked = skill.prereqs.every((p) => {
    const m = states.get(p)?.mastery;
    return m === "mastered" || m === "relearning";
  });
  return unlocked ? "learning" : "locked";
}

/** Completing a skill's lesson masters it and schedules its first review. */
export function recordSkillMastered(profileId: string, skill: Skill, now = new Date()): void {
  const states = loadSkillStates(profileId);
  const existing = states.get(skill.id);
  if (existing?.mastery === "mastered") return;
  states.set(skill.id, {
    skillId: skill.id,
    mastery: "mastered",
    fsrs: initialFsrs(now),
    streak: 0,
  });
  saveSkillStates(profileId, states);
  addXP(profileId, 20); // mastery event (§5.5)
}

/**
 * A review item outcome: FSRS update, relearning transitions, and layering
 * credit flowing down `subsumes` edges (§5.4).
 */
export function recordReviewOutcome(
  profileId: string,
  skill: Skill,
  allSkills: Skill[],
  correct: boolean,
  now = new Date()
): void {
  const states = loadSkillStates(profileId);
  const state = states.get(skill.id);
  if (!state || !state.fsrs) return;

  if (correct) {
    const fsrs = reviewFsrs(state.fsrs as FsrsState, "good", now);
    const streak = state.streak + 1;
    const mastery: Mastery =
      state.mastery === "relearning" && streak >= skill.relearnRule ? "mastered" : state.mastery;
    states.set(skill.id, { ...state, fsrs, streak, mastery });

    // Layering credit: refresh every subsumed skill that's in the pool.
    const byId = new Map(allSkills.map((s) => [s.id, s]));
    const seen = new Set<string>([skill.id]);
    const queue = [...skill.subsumes];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const sub = states.get(id);
      if (sub?.fsrs) {
        states.set(id, { ...sub, fsrs: layeredCredit(sub.fsrs as FsrsState, now) });
      }
      queue.push(...(byId.get(id)?.subsumes ?? []));
    }
  } else {
    const fsrs = reviewFsrs(state.fsrs as FsrsState, "again", now);
    states.set(skill.id, { ...state, fsrs, streak: 0, mastery: "relearning" });
  }
  saveSkillStates(profileId, states);
}

/** Skills due for review now, most overdue first. */
export function dueSkills(profileId: string, skills: Skill[], now = new Date()): Skill[] {
  const states = loadSkillStates(profileId);
  return skills
    .filter((s) => {
      const st = states.get(s.id);
      return (
        st?.fsrs &&
        (st.mastery === "mastered" || st.mastery === "relearning") &&
        s.makeReviewItem &&
        isDue(st.fsrs as FsrsState, now)
      );
    })
    .sort((a, b) => {
      const da = new Date(states.get(a.id)!.fsrs!.due).getTime();
      const db = new Date(states.get(b.id)!.fsrs!.due).getTime();
      return da - db;
    });
}

/**
 * Daily-session composer (§5.4): due reviews interleaved across units —
 * never two items from the same unit back to back when avoidable.
 */
export function composeReviewSession(
  profileId: string,
  skills: Skill[],
  now = new Date(),
  maxItems = 8
): Skill[] {
  const due = dueSkills(profileId, skills, now);
  const picked: Skill[] = [];
  const pool = [...due];
  let lastUnit = -1;
  while (picked.length < maxItems && pool.length > 0) {
    let idx = pool.findIndex((s) => s.unit !== lastUnit);
    if (idx < 0) idx = 0;
    const s = pool.splice(idx, 1)[0];
    picked.push(s);
    lastUnit = s.unit;
  }
  return picked;
}

/** Seed mastery wholesale (placement diagnostic / profile import). */
export function seedMastered(profileId: string, skillIds: string[], now = new Date()): void {
  const states = loadSkillStates(profileId);
  for (const id of skillIds) {
    if (!states.has(id)) {
      states.set(id, { skillId: id, mastery: "mastered", fsrs: initialFsrs(now, "easy"), streak: 0 });
    }
  }
  saveSkillStates(profileId, states);
}

// ----------------------------------------------------------- telemetry

export function recordAttempt(profileId: string, attempt: Attempt): void {
  const all = readJSON<Attempt[]>(telemetryKey(profileId)) ?? [];
  all.push(attempt);
  writeJSON(telemetryKey(profileId), all.slice(-TELEMETRY_CAP));
}

export function getTelemetry(profileId: string): Attempt[] {
  return readJSON<Attempt[]>(telemetryKey(profileId)) ?? [];
}

export function replaceTelemetry(profileId: string, attempts: Attempt[]): void {
  writeJSON(telemetryKey(profileId), attempts.slice(-TELEMETRY_CAP));
}

// ----------------------------------------------------------------- XP

export function getXP(profileId: string): number {
  return readJSON<number>(xpKey(profileId)) ?? 0;
}

export function addXP(profileId: string, amount: number): void {
  writeJSON(xpKey(profileId), getXP(profileId) + amount);
}
