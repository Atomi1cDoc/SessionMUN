// Typed localStorage wrapper. Primary store for roster/session/light data.
// Everything is namespaced under `sessionmun:v1:*`.

const NS = 'sessionmun:v1';

export const storage = {
  key(name: string): string {
    return `${NS}:${name}`;
  },

  get<T>(name: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(storage.key(name));
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(name: string, value: T): boolean {
    try {
      localStorage.setItem(storage.key(name), JSON.stringify(value));
      return true;
    } catch (err) {
      // Most likely QuotaExceededError — the caller can decide to offload to IDB.
      console.warn(`[storage] failed to write "${name}"`, err);
      return false;
    }
  },

  remove(name: string): void {
    try {
      localStorage.removeItem(storage.key(name));
    } catch {
      /* ignore */
    }
  },
};
