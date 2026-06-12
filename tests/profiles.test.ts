import { beforeEach, describe, expect, it } from "vitest";
import { makeMemoryStorage, setStorageBackend, writeJSON } from "../src/engine/storage";
import {
  claimLegacyProgress,
  completedLessons,
  createProfile,
  deleteProfile,
  discardLegacyProgress,
  exportProfileFile,
  hasLegacyProgress,
  importAsNewProfile,
  importReplacingProfile,
  lastActiveProfile,
  listProfiles,
  markComplete,
  parseProfileFile,
  setLastActive,
} from "../src/engine/profiles";

beforeEach(() => {
  setStorageBackend(makeMemoryStorage());
});

describe("local profiles", () => {
  it("creates, lists, and remembers the last active profile", () => {
    const ada = createProfile("Ada", "🦄");
    const max = createProfile("Max", "🦖");
    expect(listProfiles().map((p) => p.name)).toEqual(["Ada", "Max"]);

    expect(lastActiveProfile()).toBeNull();
    setLastActive(max.id);
    expect(lastActiveProfile()?.name).toBe("Max");
    expect(ada.id).not.toBe(max.id);
  });

  it("keeps progress separate per profile", () => {
    const ada = createProfile("Ada", "🦄");
    const max = createProfile("Max", "🦖");
    markComplete(ada.id, "u00.switches");
    markComplete(ada.id, "u00.counting");
    markComplete(max.id, "u00.switches");

    expect(completedLessons(ada.id).size).toBe(2);
    expect(completedLessons(max.id).size).toBe(1);
  });

  it("deleting a profile removes it and its progress", () => {
    const ada = createProfile("Ada", "🦄");
    markComplete(ada.id, "u00.switches");
    setLastActive(ada.id);

    deleteProfile(ada.id);
    expect(listProfiles()).toEqual([]);
    expect(lastActiveProfile()).toBeNull();
    expect(completedLessons(ada.id).size).toBe(0);
  });
});

describe("legacy progress migration (pre-profile installs)", () => {
  const LEGACY_KEY = "kidassembly.progress.v1";

  it("detects old-format progress and claims it into a named profile", () => {
    writeJSON(LEGACY_KEY, { completed: ["u00.switches", "u00.counting"] });

    expect(hasLegacyProgress()).toBe(true);
    const profile = claimLegacyProgress("Ada", "🦄");

    expect(profile.name).toBe("Ada");
    expect(completedLessons(profile.id)).toEqual(new Set(["u00.switches", "u00.counting"]));
    expect(hasLegacyProgress()).toBe(false); // old key consumed
  });

  it("silently cleans up an empty legacy record", () => {
    writeJSON(LEGACY_KEY, { completed: [] });
    expect(hasLegacyProgress()).toBe(false);
    expect(hasLegacyProgress()).toBe(false); // and the key is gone
  });

  it("can discard legacy progress instead", () => {
    writeJSON(LEGACY_KEY, { completed: ["u00.switches"] });
    discardLegacyProgress();
    expect(hasLegacyProgress()).toBe(false);
  });

  it("reports nothing when there was no previous install", () => {
    expect(hasLegacyProgress()).toBe(false);
  });
});

describe("profile export/import (§8.2 round-trip acceptance)", () => {
  it("export → import on a clean store reproduces name, avatar, and progress", () => {
    const ada = createProfile("Ada", "🦄");
    markComplete(ada.id, "u00.switches");
    markComplete(ada.id, "u01.boxes");
    const json = JSON.stringify(exportProfileFile(ada));

    // fresh browser
    setStorageBackend(makeMemoryStorage());
    const imported = importAsNewProfile(parseProfileFile(json));

    expect(imported.name).toBe("Ada");
    expect(imported.avatar).toBe("🦄");
    expect(completedLessons(imported.id)).toEqual(new Set(["u00.switches", "u01.boxes"]));
  });

  it("import can replace an existing profile's progress", () => {
    const ada = createProfile("Ada", "🦄");
    markComplete(ada.id, "u00.switches");
    const backup = JSON.stringify(exportProfileFile(ada));

    markComplete(ada.id, "u00.counting"); // progress after the backup
    expect(completedLessons(ada.id).size).toBe(2);

    importReplacingProfile(parseProfileFile(backup), ada.id);
    expect(completedLessons(ada.id)).toEqual(new Set(["u00.switches"])); // restored
    expect(listProfiles().length).toBe(1); // no duplicate created
  });

  it("import as new never touches the existing profile", () => {
    const ada = createProfile("Ada", "🦄");
    markComplete(ada.id, "u00.switches");
    const file = parseProfileFile(JSON.stringify(exportProfileFile(ada)));

    const copy = importAsNewProfile(file);
    markComplete(copy.id, "u00.counting");

    expect(completedLessons(ada.id).size).toBe(1);
    expect(listProfiles().length).toBe(2);
  });

  it("rejects files it can't honor, with child-readable messages", () => {
    expect(() => parseProfileFile("not json")).toThrow(/JSON/);
    expect(() => parseProfileFile(JSON.stringify({ format: "nope" }))).toThrow(/profile/);
    const good = exportProfileFile(createProfile("Ada", "🦄"));
    expect(() =>
      parseProfileFile(JSON.stringify({ ...good, formatVersion: 99 }))
    ).toThrow(/version 99/);
    expect(() =>
      parseProfileFile(JSON.stringify({ ...good, profile: { name: "" } }))
    ).toThrow(/name/);
    expect(() =>
      parseProfileFile(JSON.stringify({ ...good, completedLessons: "oops" }))
    ).toThrow(/progress/);
  });

  it("export file matches the §8.3 envelope", () => {
    const file = exportProfileFile(createProfile("Ada", "🦄"));
    expect(file.format).toBe("bitbot-profile");
    expect(file.formatVersion).toBe(1);
    expect(file.skills).toEqual([]);
    expect(file.telemetry).toEqual([]);
    expect(file.playgroundSaves).toEqual({ programs: [], snapshots: [] });
  });
});
