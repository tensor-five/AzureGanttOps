import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch
} from "../../shared/user-preferences/user-preferences.client.js";

const STORAGE_KEY = "azure-ganttops.timeline-label-fields.v1";
export const DEFAULT_TIMELINE_LABEL_FIELDS = ["title"] as const;

let memoryTimelineLabelFields: string[] | null = null;
let hydrationStarted = false;

export function loadLastTimelineLabelFields(): string[] | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    memoryTimelineLabelFields = fromStorage;
    return fromStorage;
  }

  const fromCache = sanitizeTimelineLabelFields(getCachedUserPreferences().timelineLabelFields);
  if (fromCache) {
    memoryTimelineLabelFields = fromCache;
    writeToLocalStorage(fromCache);
    return fromCache;
  }

  return memoryTimelineLabelFields;
}

export function saveTimelineLabelFields(fieldRefs: string[]): void {
  const sanitized = sanitizeTimelineLabelFields(fieldRefs) ?? [...DEFAULT_TIMELINE_LABEL_FIELDS];
  memoryTimelineLabelFields = sanitized;
  writeToLocalStorage(sanitized);
  persistUserPreferencesPatch({
    timelineLabelFields: sanitized
  });
}

export function hydrateTimelineLabelFieldsPreference(onHydrated?: (fieldRefs: string[]) => void): void {
  if (hydrationStarted) {
    return;
  }

  hydrationStarted = true;
  void hydrateUserPreferences().then((preferences) => {
    const fieldRefs = sanitizeTimelineLabelFields(preferences.timelineLabelFields);
    if (!fieldRefs) {
      return;
    }

    memoryTimelineLabelFields = fieldRefs;
    writeToLocalStorage(fieldRefs);
    onHydrated?.(fieldRefs);
  });
}

export function clearTimelineLabelFieldsPreferenceForTests(): void {
  memoryTimelineLabelFields = null;
  hydrationStarted = false;

  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }
}

function readFromLocalStorage(): string[] | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeTimelineLabelFields(parsed);
  } catch {
    return null;
  }
}

function writeToLocalStorage(fieldRefs: string[]): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(fieldRefs));
}

function sanitizeTimelineLabelFields(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = [...new Set(value)]
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : null;
}
