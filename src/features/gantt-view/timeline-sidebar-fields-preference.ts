import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-fields.v1";
export const DEFAULT_TIMELINE_SIDEBAR_FIELDS = ["title"] as const;

const store = createUserPreferenceStore<string[]>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineSidebarFields"),
  sanitize: sanitizeTimelineSidebarFields,
  buildPatch: (fieldRefs, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineSidebarFields",
      value: fieldRefs,
      cachedPreferences,
      scopeKey
    })
});

export function loadLastTimelineSidebarFields(queryId?: string | null): string[] | null {
  return store.load({ scopeKey: queryId });
}

export function saveTimelineSidebarFields(fieldRefs: string[], queryId?: string | null): void {
  store.save(sanitizeTimelineSidebarFields(fieldRefs) ?? [], { scopeKey: queryId });
}

export function hydrateTimelineSidebarFieldsPreference(
  onHydrated?: (fieldRefs: string[]) => void,
  queryId?: string | null
): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
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
