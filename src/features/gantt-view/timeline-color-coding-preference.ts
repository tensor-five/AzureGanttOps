import {
  type UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";
import { createUserPreferenceStore } from "./create-user-preference-store.js";

export type TimelineColorCoding = "none" | "person" | "status" | "parent" | "overdue" | "field";
export type TimelineFieldColorCodingConfig = {
  fieldRef: string | null;
  valueColors: Record<string, string>;
};

const STORAGE_KEY = "azure-ganttops.timeline-color-coding";
const FIELD_STORAGE_KEY = "azure-ganttops.timeline-field-color-coding";

const modeStore = createUserPreferenceStore<TimelineColorCoding>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineColorCoding,
  sanitize: sanitizeTimelineColorCoding,
  buildPatch: (mode) => ({
    timelineColorCoding: mode
  }),
  serialize: (mode) => mode,
  deserialize: (raw) => raw
});

const fieldConfigStore = createUserPreferenceStore<TimelineFieldColorCodingConfig>({
  storageKey: FIELD_STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineFieldColorCoding,
  sanitize: sanitizeFieldConfig,
  buildPatch: (config, cachedPreferences) => ({
    timelineFieldColorCoding: buildTimelineFieldColorCodingPatch(config, cachedPreferences)
  })
});

export function loadLastTimelineColorCoding(): TimelineColorCoding | null {
  return modeStore.load();
}

export function saveLastTimelineColorCoding(mode: TimelineColorCoding): void {
  modeStore.save(mode);
}

export function loadTimelineFieldColorCodingConfig(): TimelineFieldColorCodingConfig {
  return fieldConfigStore.load() ?? {
    fieldRef: null,
    valueColors: {}
  };
}

export function saveTimelineFieldColorCodingConfig(config: TimelineFieldColorCodingConfig): void {
  fieldConfigStore.save(config);
}

export function hydrateTimelineColorCodingPreference(onHydrated?: (mode: TimelineColorCoding) => void): void {
  modeStore.hydrate(onHydrated);
  fieldConfigStore.hydrate();
}

export function clearTimelineColorCodingPreferenceForTests(): void {
  modeStore.clearForTests();
  fieldConfigStore.clearForTests();
}

function sanitizeTimelineColorCoding(value: unknown): TimelineColorCoding | null {
  if (value === "none" || value === "person" || value === "status" || value === "parent" || value === "overdue" || value === "field") {
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
} {
  return {
    fieldRef: config.fieldRef ?? undefined,
    valueColors: Object.keys(config.valueColors).length > 0 ? config.valueColors : undefined
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

  return {
    fieldRef,
    valueColors
  };
}
