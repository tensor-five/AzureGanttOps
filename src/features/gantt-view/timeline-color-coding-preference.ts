import {
  type UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";
import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

export type TimelineColorCoding = "none" | "status" | "parent" | "overdue" | "field";
export type TimelineFieldColorCodingConfig = {
  fieldRef: string | null;
  valueColors: Record<string, string>;
  overdueExcludedStateCodes: string[];
};

export const DEFAULT_OVERDUE_EXCLUDED_STATE_CODES = ["closed", "done", "removed", "completed"];

const STORAGE_KEY = "azure-ganttops.timeline-color-coding";
const FIELD_STORAGE_KEY = "azure-ganttops.timeline-field-color-coding";

const modeStore = createUserPreferenceStore<TimelineColorCoding>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineColorCoding"),
  sanitize: sanitizeTimelineColorCoding,
  buildPatch: (mode, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineColorCoding",
      value: mode,
      cachedPreferences,
      scopeKey
    }),
  serialize: (mode) => mode,
  deserialize: (raw) => raw
});

const fieldConfigStore = createUserPreferenceStore<TimelineFieldColorCodingConfig>({
  storageKey: FIELD_STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineFieldColorCoding"),
  sanitize: sanitizeFieldConfig,
  buildPatch: (config, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineFieldColorCoding",
      value: buildTimelineFieldColorCodingPatch(config, cachedPreferences),
      cachedPreferences,
      scopeKey
    })
});

export function loadLastTimelineColorCoding(queryId?: string | null): TimelineColorCoding | null {
  return modeStore.load({ scopeKey: queryId });
}

export function saveLastTimelineColorCoding(mode: TimelineColorCoding, queryId?: string | null): void {
  modeStore.save(mode, { scopeKey: queryId });
}

export function loadTimelineFieldColorCodingConfig(queryId?: string | null): TimelineFieldColorCodingConfig {
  return fieldConfigStore.load({ scopeKey: queryId }) ?? {
    fieldRef: null,
    valueColors: {},
    overdueExcludedStateCodes: [...DEFAULT_OVERDUE_EXCLUDED_STATE_CODES]
  };
}

export function saveTimelineFieldColorCodingConfig(config: TimelineFieldColorCodingConfig, queryId?: string | null): void {
  fieldConfigStore.save(config, { scopeKey: queryId });
}

export function hydrateTimelineColorCodingPreference(
  onHydrated?: (mode: TimelineColorCoding) => void,
  queryId?: string | null
): void {
  modeStore.hydrate(onHydrated, { scopeKey: queryId });
  fieldConfigStore.hydrate(undefined, { scopeKey: queryId });
}

export function clearTimelineColorCodingPreferenceForTests(): void {
  modeStore.clearForTests();
  fieldConfigStore.clearForTests();
}

function sanitizeTimelineColorCoding(value: unknown): TimelineColorCoding | null {
  if (value === "none" || value === "status" || value === "parent" || value === "overdue" || value === "field") {
    return value;
  }

  return null;
}

function buildTimelineFieldColorCodingPatch(
  config: TimelineFieldColorCodingConfig,
  _cachedPreferences: UserPreferences
): {
  fieldRef?: string;
  valueColors?: Record<string, string>;
  overdueExcludedStateCodes?: string[];
} {
  return {
    fieldRef: config.fieldRef ?? undefined,
    valueColors: Object.keys(config.valueColors).length > 0 ? config.valueColors : undefined,
    overdueExcludedStateCodes: config.overdueExcludedStateCodes
  };
}

function sanitizeFieldConfig(value: unknown): TimelineFieldColorCodingConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const fieldRefRaw = candidate.fieldRef;
  const fieldRef = typeof fieldRefRaw === "string" && fieldRefRaw.trim().length > 0 ? fieldRefRaw.trim() : null;
  const valueColorsRaw =
    candidate.valueColors && typeof candidate.valueColors === "object" && !Array.isArray(candidate.valueColors)
      ? (candidate.valueColors as Record<string, unknown>)
      : {};
  const overdueExcludedStateCodesRaw = Array.isArray(candidate.overdueExcludedStateCodes)
    ? candidate.overdueExcludedStateCodes
    : null;
  const valueColors: Record<string, string> = {};

  Object.entries(valueColorsRaw).forEach(([key, color]) => {
    if (typeof color !== "string") {
      return;
    }

    const normalized = color.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(normalized)) {
      valueColors[key] = normalized;
    }
  });

  const overdueExcludedStateCodes = sanitizeOverdueExcludedStateCodes(overdueExcludedStateCodesRaw);

  return {
    fieldRef,
    valueColors,
    overdueExcludedStateCodes
  };
}

function sanitizeOverdueExcludedStateCodes(value: unknown[] | null): string[] {
  if (!value) {
    return [...DEFAULT_OVERDUE_EXCLUDED_STATE_CODES];
  }

  return [...new Set(value)]
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter((entry) => entry.length > 0);
}
