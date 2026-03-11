import { createUserPreferenceStore } from "./create-user-preference-store.js";

const STORAGE_KEY = "azure-ganttops.timeline-label-fields.v1";
export const DEFAULT_TIMELINE_LABEL_FIELDS = ["title"] as const;

const store = createUserPreferenceStore<string[]>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineLabelFields,
  sanitize: sanitizeTimelineLabelFields,
  buildPatch: (fieldRefs) => ({
    timelineLabelFields: fieldRefs
  })
});

export function loadLastTimelineLabelFields(): string[] | null {
  return store.load();
}

export function saveTimelineLabelFields(fieldRefs: string[]): void {
  store.save(sanitizeTimelineLabelFields(fieldRefs) ?? []);
}

export function hydrateTimelineLabelFieldsPreference(onHydrated?: (fieldRefs: string[]) => void): void {
  store.hydrate(onHydrated);
}

export function clearTimelineLabelFieldsPreferenceForTests(): void {
  store.clearForTests();
}

function sanitizeTimelineLabelFields(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return [...new Set(value)]
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}
