/**
 * Tiny typed wrapper over localStorage with a swappable backend so the
 * engine stays testable in Node. (IndexedDB replaces this in Phase 2 when
 * per-attempt telemetry starts accumulating — §8.2.)
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

let backend: StorageLike =
  typeof localStorage !== "undefined" ? localStorage : new MemoryStorage();

export function setStorageBackend(s: StorageLike): void {
  backend = s;
}

export function makeMemoryStorage(): StorageLike {
  return new MemoryStorage();
}

export function readJSON<T>(key: string): T | null {
  try {
    const raw = backend.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // corrupted or blocked storage — treat as absent
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    backend.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the write just doesn't persist */
  }
}

export function removeKey(key: string): void {
  try {
    backend.removeItem(key);
  } catch {
    /* ignore */
  }
}
