/**
 * Phase-1 progress store: which lessons are complete, per browser.
 * The full mastery/FSRS engine and multi-profile store arrive in Phase 2;
 * this is deliberately tiny so nothing here needs migrating except the key.
 */
const KEY = "kidassembly.progress.v1";

interface ProgressData {
  completed: string[];
}

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ProgressData;
  } catch {
    /* corrupted or unavailable storage — start fresh */
  }
  return { completed: [] };
}

export function completedLessons(): Set<string> {
  return new Set(load().completed);
}

export function markComplete(lessonId: string): void {
  const data = load();
  if (!data.completed.includes(lessonId)) {
    data.completed.push(lessonId);
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked — progress just won't persist */
    }
  }
}
