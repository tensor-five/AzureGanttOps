import { createUserPreferenceStore } from "./create-user-preference-store.js";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-fields.v1";
export const DEFAULT_TIMELINE_SIDEBAR_FIELDS = ["title"] as const;

const store = createUserPreferenceStore<string[]>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineSidebarFields,
  sanitize: sanitizeTimelineSidebarFields,
  buildPatch: (fieldRefs) => ({
    timelineSidebarFields: fieldRefs
  })
});

export function loadLastTimelineSidebarFields(): string[] | null {
  return store.load();
}

export function saveTimelineSidebarFields(fieldRefs: string[]): void {
  store.save(sanitizeTimelineSidebarFields(fieldRefs) ?? []);
}

export function hydrateTimelineSidebarFieldsPreference(onHydrated?: (fieldRefs: string[]) => void): void {
  store.hydrate(onHydrated);
}

export function clearTimelineSidebarFieldsPreferenceForTests(): void {
  store.clearForTests();
}

function sanitizeTimelineSidebarFields(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return [...new Set(value)]
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}
