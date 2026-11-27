import { mkdir, readFile, writeFile } from "node:fs/promises";
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

  public async deleteCurrentUserPreferences(): Promise<boolean> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      if (!Object.prototype.hasOwnProperty.call(db.data.users, this.userId)) {
        return false;
      }

      await db.update((data) => {
        delete data.users[this.userId];
      });
      return true;
    }

    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return false;
      }

      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("User preferences file is malformed JSON");
    }

    if (!isValidDb(parsed)) {
      throw new Error("User preferences file has invalid shape");
    }

    if (!Object.prototype.hasOwnProperty.call(parsed.users, this.userId)) {
      return false;
    }

    delete parsed.users[this.userId];
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    return true;
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === "object" && "code" in error;
}
