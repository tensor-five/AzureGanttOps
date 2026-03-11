import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch
} from "../../shared/user-preferences/user-preferences.client.js";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-fields.v1";
export const DEFAULT_TIMELINE_SIDEBAR_FIELDS = ["title"] as const;

let memoryTimelineSidebarFields: string[] | null = null;
let hydrationStarted = false;

export function loadLastTimelineSidebarFields(): string[] | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    memoryTimelineSidebarFields = fromStorage;
    return fromStorage;
  }

  const fromCache = sanitizeTimelineSidebarFields(getCachedUserPreferences().timelineSidebarFields);
  if (fromCache) {
    memoryTimelineSidebarFields = fromCache;
    writeToLocalStorage(fromCache);
    return fromCache;
  }

  return memoryTimelineSidebarFields;
}

export function saveTimelineSidebarFields(fieldRefs: string[]): void {
  const sanitized = sanitizeTimelineSidebarFields(fieldRefs) ?? [];
  memoryTimelineSidebarFields = sanitized;
  writeToLocalStorage(sanitized);
  persistUserPreferencesPatch({
    timelineSidebarFields: sanitized
  });
}

export function hydrateTimelineSidebarFieldsPreference(onHydrated?: (fieldRefs: string[]) => void): void {
  if (hydrationStarted) {
    return;
  }

  hydrationStarted = true;
  void hydrateUserPreferences().then((preferences) => {
    const fieldRefs = sanitizeTimelineSidebarFields(preferences.timelineSidebarFields);
    if (!fieldRefs) {
      return;
    }

    memoryTimelineSidebarFields = fieldRefs;
    writeToLocalStorage(fieldRefs);
    onHydrated?.(fieldRefs);
  });
}

export function clearTimelineSidebarFieldsPreferenceForTests(): void {
  memoryTimelineSidebarFields = null;
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
    return sanitizeTimelineSidebarFields(parsed);
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

function sanitizeTimelineSidebarFields(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return [...new Set(value)]
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}
