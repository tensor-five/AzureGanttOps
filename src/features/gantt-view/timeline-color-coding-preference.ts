import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch
} from "../../shared/user-preferences/user-preferences.client.js";

export type TimelineColorCoding = "none" | "person" | "status" | "parent" | "overdue" | "field";
export type TimelineFieldColorCodingConfig = {
  fieldRef: string | null;
  valueColors: Record<string, string>;
};

const STORAGE_KEY = "azure-ganttops.timeline-color-coding";
const FIELD_STORAGE_KEY = "azure-ganttops.timeline-field-color-coding";

let memoryColorCoding: TimelineColorCoding | null = null;
let memoryFieldConfig: TimelineFieldColorCodingConfig | null = null;
let hydrationStarted = false;

export function loadLastTimelineColorCoding(): TimelineColorCoding | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    memoryColorCoding = fromStorage;
    return fromStorage;
  }

  const fromCache = getCachedUserPreferences().timelineColorCoding;
  if (fromCache) {
    memoryColorCoding = fromCache;
    writeToLocalStorage(fromCache);
    return fromCache;
  }

  return memoryColorCoding;
}

export function saveLastTimelineColorCoding(mode: TimelineColorCoding): void {
  memoryColorCoding = mode;
  writeToLocalStorage(mode);
  persistUserPreferencesPatch({
    timelineColorCoding: mode
  });
}

export function loadTimelineFieldColorCodingConfig(): TimelineFieldColorCodingConfig {
  const fromStorage = readFieldConfigFromLocalStorage();
  if (fromStorage) {
    memoryFieldConfig = fromStorage;
    return fromStorage;
  }

  const fromCache = sanitizeFieldConfig(getCachedUserPreferences().timelineFieldColorCoding);
  if (fromCache) {
    memoryFieldConfig = fromCache;
    writeFieldConfigToLocalStorage(fromCache);
    return fromCache;
  }

  if (memoryFieldConfig) {
    return memoryFieldConfig;
  }

  return {
    fieldRef: null,
    valueColors: {}
  };
}

export function saveTimelineFieldColorCodingConfig(config: TimelineFieldColorCodingConfig): void {
  const sanitized = sanitizeFieldConfig(config) ?? { fieldRef: null, valueColors: {} };
  memoryFieldConfig = sanitized;
  writeFieldConfigToLocalStorage(sanitized);
  persistUserPreferencesPatch({
    timelineFieldColorCoding: {
      fieldRef: sanitized.fieldRef ?? undefined,
      valueColors: Object.keys(sanitized.valueColors).length > 0 ? sanitized.valueColors : undefined
    }
  });
}

export function hydrateTimelineColorCodingPreference(onHydrated?: (mode: TimelineColorCoding) => void): void {
  if (hydrationStarted) {
    return;
  }

  hydrationStarted = true;
  void hydrateUserPreferences().then((preferences) => {
    const mode = preferences.timelineColorCoding;
    if (!mode) {
      const fieldConfig = sanitizeFieldConfig(preferences.timelineFieldColorCoding);
      if (fieldConfig) {
        memoryFieldConfig = fieldConfig;
        writeFieldConfigToLocalStorage(fieldConfig);
      }
      return;
    }

    memoryColorCoding = mode;
    writeToLocalStorage(mode);
    const fieldConfig = sanitizeFieldConfig(preferences.timelineFieldColorCoding);
    if (fieldConfig) {
      memoryFieldConfig = fieldConfig;
      writeFieldConfigToLocalStorage(fieldConfig);
    }
    onHydrated?.(mode);
  });
}

export function clearTimelineColorCodingPreferenceForTests(): void {
  memoryColorCoding = null;
  memoryFieldConfig = null;
  hydrationStarted = false;

  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.removeItem(STORAGE_KEY);
    globalThis.localStorage.removeItem(FIELD_STORAGE_KEY);
  }
}

function readFromLocalStorage(): TimelineColorCoding | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  const value = globalThis.localStorage.getItem(STORAGE_KEY);
  if (value === "none" || value === "person" || value === "status" || value === "parent" || value === "overdue" || value === "field") {
    return value;
  }

  return null;
}

function writeToLocalStorage(mode: TimelineColorCoding): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, mode);
}

function readFieldConfigFromLocalStorage(): TimelineFieldColorCodingConfig | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  const raw = globalThis.localStorage.getItem(FIELD_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeFieldConfig(parsed);
  } catch {
    return null;
  }
}

function writeFieldConfigToLocalStorage(config: TimelineFieldColorCodingConfig): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(FIELD_STORAGE_KEY, JSON.stringify(config));
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
