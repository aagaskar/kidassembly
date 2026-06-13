/**
 * Generic scaffolding state for problem types that benefit from temporary hints.
 *
 * Pedagogical policy: give explicit support at first, fade it after success to
 * encourage retrieval, remove it after repeated success, and immediately bring
 * it back after an error so the student can repair the misconception without
 * unproductive struggle.
 */
export type ScaffoldLevel = "full" | "faded" | "hidden";
export type ScaffoldOverride = ScaffoldLevel | "auto";

export interface ScaffoldProgress {
  level: ScaffoldLevel;
  correctStreak: number;
}

export type ScaffoldState = Record<string, ScaffoldProgress>;

export function currentScaffoldLevel(state: ScaffoldState, scaffoldId?: string): ScaffoldLevel {
  if (!scaffoldId) return "hidden";
  return state[scaffoldId]?.level ?? "full";
}

export function resolveScaffoldLevel(
  state: ScaffoldState,
  scaffoldId: string | undefined,
  override: ScaffoldOverride = "auto"
): ScaffoldLevel {
  return override === "auto" ? currentScaffoldLevel(state, scaffoldId) : override;
}

export function updateScaffoldAfterAttempt(
  state: ScaffoldState,
  scaffoldId: string | undefined,
  correct: boolean
): ScaffoldState {
  if (!scaffoldId) return state;
  if (!correct) {
    return {
      ...state,
      [scaffoldId]: { level: "full", correctStreak: 0 },
    };
  }

  const nextStreak = (state[scaffoldId]?.correctStreak ?? 0) + 1;
  const level: ScaffoldLevel = nextStreak >= 2 ? "hidden" : "faded";
  return {
    ...state,
    [scaffoldId]: { level, correctStreak: nextStreak },
  };
}
