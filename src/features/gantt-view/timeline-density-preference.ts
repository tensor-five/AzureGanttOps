import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

export type TimelineDensity = "comfortable" | "compact";

const STORAGE_KEY = "azure-ganttops.timeline-density";

const store = createUserPreferenceStore<TimelineDensity>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineDensity"),
  sanitize: (value) => (value === "comfortable" || value === "compact" ? value : null),
  buildPatch: (density, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineDensity",
      value: density,
      cachedPreferences,
      scopeKey
    }),
  serialize: (density) => density,
  deserialize: (raw) => raw
});

export function loadLastDensity(queryId?: string | null): TimelineDensity | null {
  return store.load({ scopeKey: queryId });
}

export function saveLastDensity(density: TimelineDensity, queryId?: string | null): void {
  store.save(density, { scopeKey: queryId });
}

export function hydrateTimelineDensityPreference(onHydrated?: (density: TimelineDensity) => void, queryId?: string | null): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
}

export function clearTimelineDensityPreferenceForTests(): void {
  store.clearForTests();
}
