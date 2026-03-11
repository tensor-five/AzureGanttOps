import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

import { sanitizeUserPreferences, type UserPreferences } from "../../../shared/user-preferences/user-preferences.schema.js";

export type { UserPreferences } from "../../../shared/user-preferences/user-preferences.schema.js";

type PersistedPreferencesDb = {
  version: 1;
  users: Record<string, UserPreferences>;
};

const DEFAULT_DB: PersistedPreferencesDb = {
  version: 1,
  users: {}
};

export class LowdbUserPreferencesAdapter {
  private dbPromise: Promise<Low<PersistedPreferencesDb>> | null = null;

  public constructor(
    private readonly filePath: string,
    private readonly userId: string
  ) {}

  public async getPreferences(): Promise<UserPreferences> {
    const db = await this.getDb();
    const existing = db.data.users[this.userId];

    if (!existing) {
      return {};
    }

    return sanitizeUserPreferences(existing);
  }

  public async mergePreferences(patch: UserPreferences): Promise<UserPreferences> {
    const db = await this.getDb();
    const incoming = sanitizeUserPreferences(patch);

    await db.update((data) => {
      const current = sanitizeUserPreferences(data.users[this.userId] ?? {});
      data.users[this.userId] = {
        ...current,
        ...incoming,
        savedQueries: incoming.savedQueries ?? current.savedQueries,
        filters: incoming.filters ?? current.filters,
        views: incoming.views ?? current.views,
        updatedAt: new Date().toISOString()
      };
    });

    return sanitizeUserPreferences(db.data.users[this.userId] ?? {});
  }

  private async getDb(): Promise<Low<PersistedPreferencesDb>> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = (async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const db = await JSONFilePreset<PersistedPreferencesDb>(this.filePath, DEFAULT_DB);

      if (!isValidDb(db.data)) {
        db.data = DEFAULT_DB;
        await db.write();
      }

      return db;
    })();

    return this.dbPromise;
  }
}

function isValidDb(value: unknown): value is PersistedPreferencesDb {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) {
    return false;
  }

  if (!isPlainRecord(candidate.users)) {
    return false;
  }

  return Object.values(candidate.users).every((entry) => !!entry && typeof entry === "object");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
