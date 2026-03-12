import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

const STORAGE_KEY = "azure-ganttops.timeline-label-fields.v1";
export const DEFAULT_TIMELINE_LABEL_FIELDS = ["title"] as const;

const store = createUserPreferenceStore<string[]>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineLabelFields"),
  sanitize: sanitizeTimelineLabelFields,
  buildPatch: (fieldRefs, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineLabelFields",
      value: fieldRefs,
      cachedPreferences,
      scopeKey
    })
});

export function loadLastTimelineLabelFields(queryId?: string | null): string[] | null {
  return store.load({ scopeKey: queryId });
}

export function saveTimelineLabelFields(fieldRefs: string[], queryId?: string | null): void {
  store.save(sanitizeTimelineLabelFields(fieldRefs) ?? [], { scopeKey: queryId });
}

export function hydrateTimelineLabelFieldsPreference(
  onHydrated?: (fieldRefs: string[]) => void,
  queryId?: string | null
): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
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
