/**
 * TTL cache for conditions-derived data (signal snapshots, overlays). The
 * interface is what the overlay depends on; the in-memory implementation makes
 * the path runnable and testable, and a Postgres-backed implementation over
 * the conditions_cache table is the production swap. Keyed by (key, dataType)
 * so an overlay and a raw snapshot for the same location never collide.
 */

export interface ConditionsCache {
  get<T>(key: string, dataType: string): Promise<T | null>;
  set<T>(key: string, dataType: string, value: T, ttlMinutes: number): Promise<void>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class InMemoryConditionsCache implements ConditionsCache {
  private readonly entries = new Map<string, Entry>();
  private readonly clock: () => number;

  constructor(clock: () => number = Date.now) {
    this.clock = clock;
  }

  async get<T>(key: string, dataType: string): Promise<T | null> {
    const entry = this.entries.get(`${key}:${dataType}`);
    if (!entry) return null;
    if (entry.expiresAt <= this.clock()) {
      this.entries.delete(`${key}:${dataType}`);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, dataType: string, value: T, ttlMinutes: number): Promise<void> {
    this.entries.set(`${key}:${dataType}`, {
      value,
      expiresAt: this.clock() + ttlMinutes * 60_000,
    });
  }
}
