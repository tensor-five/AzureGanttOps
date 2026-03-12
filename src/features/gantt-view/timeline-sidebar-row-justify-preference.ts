import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

export type TimelineSidebarRowJustify = "flex-start" | "flex-end";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-row-justify.v1";

const store = createUserPreferenceStore<TimelineSidebarRowJustify>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineSidebarRowJustify"),
  sanitize: sanitizeTimelineSidebarRowJustify,
  buildPatch: (justify, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineSidebarRowJustify",
      value: justify,
      cachedPreferences,
      scopeKey
    }),
  serialize: (justify) => justify,
  deserialize: (raw) => raw
});

export function loadLastTimelineSidebarRowJustify(queryId?: string | null): TimelineSidebarRowJustify | null {
  return store.load({ scopeKey: queryId });
}

export function saveTimelineSidebarRowJustify(justify: TimelineSidebarRowJustify, queryId?: string | null): void {
  store.save(justify, { scopeKey: queryId });
}

export function hydrateTimelineSidebarRowJustifyPreference(
  onHydrated?: (justify: TimelineSidebarRowJustify) => void,
  queryId?: string | null
): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
}

export function clearTimelineSidebarRowJustifyPreferenceForTests(): void {
  store.clearForTests();
}

function sanitizeTimelineSidebarRowJustify(value: unknown): TimelineSidebarRowJustify | null {
  return value === "flex-start" || value === "flex-end" ? value : null;
}
