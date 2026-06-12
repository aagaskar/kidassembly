import { readJSON, removeKey, writeJSON } from "./storage";
import { Attempt, StudentSkillState } from "./skills";
import {
  getTelemetry,
  getXP,
  loadSkillStates,
  replaceSkillStates,
  replaceTelemetry,
} from "./mastery";

/**
 * Local profiles (§8.2): a picker convenience for families sharing a device,
 * NOT a security boundary — no passwords, and the UI says so.
 */
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: string;
}

export interface ProfileSettings {
  /** Input-mode ladder (§9): tiles → typed operands → full editor. */
  inputMode?: "tiles" | "mixed" | "text";
  /** Parent toggle: show every playground tool regardless of progress (§8.1). */
  unlockAll?: boolean;
  [k: string]: unknown;
}

/** On-disk profile export (§8.3). Version 2 carries the full Phase-2 state:
 * skill states with FSRS schedules, telemetry, XP, settings. Version-1
 * files (lesson completion only) still import. */
export interface ProfileFile {
  format: "bitbot-profile";
  formatVersion: 1 | 2;
  exportedAt: string;
  appVersion: string;
  profile: { name: string; avatar: string; settings: ProfileSettings };
  completedLessons: string[];
  skills: StudentSkillState[];
  telemetry: Attempt[];
  xp?: number;
  playgroundSaves: { programs: unknown[]; snapshots: unknown[] };
}

const APP_VERSION = "0.2.0";
const PROFILES_KEY = "kidassembly.profiles.v1";
/** The pre-profiles progress key — a single shared record (see migration). */
const LEGACY_PROGRESS_KEY = "kidassembly.progress.v1";
const progressKey = (profileId: string) => `kidassembly.progress.v1.${profileId}`;

interface ProfilesData {
  profiles: Profile[];
  lastActiveId: string | null;
}

interface ProgressData {
  completed: string[];
}

function loadData(): ProfilesData {
  return readJSON<ProfilesData>(PROFILES_KEY) ?? { profiles: [], lastActiveId: null };
}

function saveData(data: ProfilesData): void {
  writeJSON(PROFILES_KEY, data);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------- profiles

export function listProfiles(): Profile[] {
  return loadData().profiles;
}

export function createProfile(name: string, avatar: string): Profile {
  const profile: Profile = {
    id: newId(),
    name: name.trim(),
    avatar,
    createdAt: new Date().toISOString(),
  };
  const data = loadData();
  data.profiles.push(profile);
  saveData(data);
  return profile;
}

export function deleteProfile(profileId: string): void {
  const data = loadData();
  data.profiles = data.profiles.filter((p) => p.id !== profileId);
  if (data.lastActiveId === profileId) data.lastActiveId = null;
  saveData(data);
  removeKey(progressKey(profileId));
  removeKey(`kidassembly.skills.v1.${profileId}`);
  removeKey(`kidassembly.telemetry.v1.${profileId}`);
  removeKey(`kidassembly.xp.v1.${profileId}`);
  removeKey(`kidassembly.settings.v1.${profileId}`);
}

export function lastActiveProfile(): Profile | null {
  const data = loadData();
  return data.profiles.find((p) => p.id === data.lastActiveId) ?? null;
}

export function setLastActive(profileId: string): void {
  const data = loadData();
  data.lastActiveId = profileId;
  saveData(data);
}

// ---------------------------------------------------------------- progress

export function completedLessons(profileId: string): Set<string> {
  return new Set(readJSON<ProgressData>(progressKey(profileId))?.completed ?? []);
}

export function markComplete(profileId: string, lessonId: string): void {
  const completed = completedLessons(profileId);
  if (!completed.has(lessonId)) {
    completed.add(lessonId);
    writeJSON(progressKey(profileId), { completed: [...completed] });
  }
}

// --------------------------------------------------- legacy migration

/**
 * Progress recorded before profiles existed lives under a single shared
 * key. If there's anything in it, the picker asks who it belongs to and
 * claims it into a fresh profile; an empty record is just cleaned up.
 */
export function hasLegacyProgress(): boolean {
  const legacy = readJSON<ProgressData>(LEGACY_PROGRESS_KEY);
  if (!legacy) return false;
  if (legacy.completed.length === 0) {
    removeKey(LEGACY_PROGRESS_KEY);
    return false;
  }
  return true;
}

export function claimLegacyProgress(name: string, avatar: string): Profile {
  const legacy = readJSON<ProgressData>(LEGACY_PROGRESS_KEY);
  const profile = createProfile(name, avatar);
  if (legacy && legacy.completed.length > 0) {
    writeJSON(progressKey(profile.id), legacy);
  }
  removeKey(LEGACY_PROGRESS_KEY);
  return profile;
}

export function discardLegacyProgress(): void {
  removeKey(LEGACY_PROGRESS_KEY);
}

// --------------------------------------------------- export / import

export function getSettings(profileId: string): ProfileSettings {
  return readJSON<ProfileSettings>(`kidassembly.settings.v1.${profileId}`) ?? {};
}

export function saveSettings(profileId: string, settings: ProfileSettings): void {
  writeJSON(`kidassembly.settings.v1.${profileId}`, settings);
}

export function exportProfileFile(profile: Profile): ProfileFile {
  return {
    format: "bitbot-profile",
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    profile: { name: profile.name, avatar: profile.avatar, settings: getSettings(profile.id) },
    completedLessons: [...completedLessons(profile.id)].sort(),
    skills: [...loadSkillStates(profile.id).values()],
    telemetry: getTelemetry(profile.id),
    xp: getXP(profile.id),
    playgroundSaves: { programs: [], snapshots: [] },
  };
}

export function parseProfileFile(json: string): ProfileFile {
  let file: ProfileFile;
  try {
    file = JSON.parse(json) as ProfileFile;
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (file.format !== "bitbot-profile") {
    throw new Error("That file isn't a BitBot profile.");
  }
  if (file.formatVersion !== 1 && file.formatVersion !== 2) {
    throw new Error(
      `This profile is version ${file.formatVersion}, which this app doesn't understand yet.`
    );
  }
  if (typeof file.profile?.name !== "string" || file.profile.name.trim() === "") {
    throw new Error("This profile file has no name in it.");
  }
  if (!Array.isArray(file.completedLessons)) {
    throw new Error("This profile file has no progress list in it.");
  }
  return file;
}

function applyImportedState(profileId: string, file: ProfileFile): void {
  writeJSON(progressKey(profileId), { completed: file.completedLessons });
  saveSettings(profileId, file.profile.settings ?? {});
  // v1 files carry no skill states; the app re-derives mastery from
  // completedLessons at first load (App boot syncs lessons → skills).
  replaceSkillStates(profileId, Array.isArray(file.skills) ? file.skills : []);
  replaceTelemetry(profileId, Array.isArray(file.telemetry) ? file.telemetry : []);
  writeJSON(`kidassembly.xp.v1.${profileId}`, file.xp ?? 0);
}

/** "Add as new profile" — never touches existing profiles (§8.2). */
export function importAsNewProfile(file: ProfileFile): Profile {
  const profile = createProfile(file.profile.name, file.profile.avatar ?? "🤖");
  applyImportedState(profile.id, file);
  return profile;
}

/** "Replace existing" — overwrites the named profile's identity and progress. */
export function importReplacingProfile(file: ProfileFile, profileId: string): Profile {
  const data = loadData();
  const profile = data.profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error("That profile doesn't exist any more.");
  profile.name = file.profile.name;
  profile.avatar = file.profile.avatar ?? profile.avatar;
  saveData(data);
  applyImportedState(profileId, file);
  return profile;
}
