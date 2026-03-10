import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

export type ThemeModePreference = "system" | "light" | "dark";
export type TimelineDensityPreference = "comfortable" | "compact";
export type TimelineColorCodingPreference = "none" | "person" | "status" | "parent" | "overdue" | "field";

export type TimelineFieldColorCodingPreference = {
  fieldRef?: string;
  valueColors?: Record<string, string>;
};

export type UserPreferences = {
  themeMode?: ThemeModePreference;
  timelineDensity?: TimelineDensityPreference;
  timelineColorCoding?: TimelineColorCodingPreference;
  timelineFieldColorCoding?: TimelineFieldColorCodingPreference;
  filters?: Record<string, unknown>;
  views?: Record<string, unknown>;
  updatedAt?: string;
};

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

    return sanitizePreferences(existing);
  }

  public async mergePreferences(patch: UserPreferences): Promise<UserPreferences> {
    const db = await this.getDb();
    const incoming = sanitizePreferences(patch);

    await db.update((data) => {
      const current = sanitizePreferences(data.users[this.userId] ?? {});
      data.users[this.userId] = {
        ...current,
        ...incoming,
        filters: incoming.filters ?? current.filters,
        views: incoming.views ?? current.views,
        updatedAt: new Date().toISOString()
      };
    });

    return sanitizePreferences(db.data.users[this.userId] ?? {});
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

function sanitizePreferences(value: unknown): UserPreferences {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;

  const next: UserPreferences = {};

  if (candidate.themeMode === "system" || candidate.themeMode === "light" || candidate.themeMode === "dark") {
    next.themeMode = candidate.themeMode;
  }

  if (candidate.timelineDensity === "comfortable" || candidate.timelineDensity === "compact") {
    next.timelineDensity = candidate.timelineDensity;
  }

  if (
    candidate.timelineColorCoding === "none" ||
    candidate.timelineColorCoding === "person" ||
    candidate.timelineColorCoding === "status" ||
    candidate.timelineColorCoding === "parent" ||
    candidate.timelineColorCoding === "overdue" ||
    candidate.timelineColorCoding === "field"
  ) {
    next.timelineColorCoding = candidate.timelineColorCoding;
  }

  if (isPlainRecord(candidate.timelineFieldColorCoding)) {
    const raw = candidate.timelineFieldColorCoding as Record<string, unknown>;
    const fieldRef = typeof raw.fieldRef === "string" ? raw.fieldRef.trim() : "";
    const valueColorsRaw = isPlainRecord(raw.valueColors) ? raw.valueColors : null;
    const valueColors: Record<string, string> = {};

    if (valueColorsRaw) {
      Object.entries(valueColorsRaw).forEach(([key, value]) => {
        if (typeof value !== "string") {
          return;
        }

        const normalized = value.trim();
        if (/^#[0-9a-f]{6}$/i.test(normalized)) {
          valueColors[key] = normalized.toLowerCase();
        }
      });
    }

    next.timelineFieldColorCoding = {
      fieldRef: fieldRef.length > 0 ? fieldRef : undefined,
      valueColors: Object.keys(valueColors).length > 0 ? valueColors : undefined
    };
  }

  if (isPlainRecord(candidate.filters)) {
    next.filters = candidate.filters;
  }

  if (isPlainRecord(candidate.views)) {
    next.views = candidate.views;
  }

  if (typeof candidate.updatedAt === "string") {
    next.updatedAt = candidate.updatedAt;
  }

  return next;
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
