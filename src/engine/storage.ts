/**
 * Tiny typed wrapper over a synchronous key-value store with a swappable
 * backend so the engine stays testable in Node.
 *
 * In the browser the backend is an in-memory cache loaded from IndexedDB at
 * boot (`initStorage`) that writes through asynchronously — sync reads for
 * the engine, IndexedDB capacity for telemetry (§8.2). localStorage is the
 * fallback when IndexedDB is unavailable, and pre-existing localStorage
 * data is migrated into IndexedDB on first boot.
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

// --------------------------------------------------------- IndexedDB boot

const DB_NAME = "kidassembly";
const DB_STORE = "kv";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReadAll(db: IDBDatabase): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE);
    const out = new Map<string, string>();
    const req = tx.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.set(String(cursor.key), String(cursor.value));
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** In-memory cache with async write-through to IndexedDB. */
class IDBWriteThrough implements StorageLike {
  constructor(private db: IDBDatabase, private cache: Map<string, string>) {}
  getItem(key: string) {
    return this.cache.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.cache.set(key, value);
    try {
      this.db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(value, key);
    } catch {
      /* a failed async write loses persistence, not correctness */
    }
  }
  removeItem(key: string) {
    this.cache.delete(key);
    try {
      this.db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).delete(key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Boot the persistent backend. Call (and await) once before first render.
 * Safe to skip in tests — the in-memory/localStorage default still works.
 */
export async function initStorage(): Promise<void> {
  if (typeof indexedDB === "undefined") return; // keep localStorage fallback
  try {
    const db = await openDB();
    const cache = await idbReadAll(db);
    // One-time migration of pre-IndexedDB localStorage data.
    if (cache.size === 0 && typeof localStorage !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("kidassembly.")) {
          cache.set(key, localStorage.getItem(key)!);
        }
      }
      const store = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE);
      for (const [k, v] of cache) store.put(v, k);
    }
    backend = new IDBWriteThrough(db, cache);
  } catch {
    /* IndexedDB blocked (private mode etc.) — stay on localStorage */
  }
}
