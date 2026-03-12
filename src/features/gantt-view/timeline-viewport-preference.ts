import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

export type TimelineViewportPreference = {
  dayWidthPx: number;
  scrollLeftPx: number;
  scrollTopPx: number;
};

const STORAGE_KEY = "azure-ganttops.timeline-viewport";

const store = createUserPreferenceStore<TimelineViewportPreference>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineViewport"),
  sanitize: normalizeViewport,
  buildPatch: (viewport, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineViewport",
      value: viewport,
      cachedPreferences,
      scopeKey
    })
});

export function loadLastTimelineViewportPreference(queryId?: string | null): TimelineViewportPreference | null {
  return store.load({ scopeKey: queryId });
}

export function saveTimelineViewportPreference(viewport: TimelineViewportPreference, queryId?: string | null): void {
  store.save(viewport, { scopeKey: queryId });
}

export function hydrateTimelineViewportPreference(
  onHydrated?: (viewport: TimelineViewportPreference) => void,
  queryId?: string | null
): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
}

export function clearTimelineViewportPreferenceForTests(): void {
  store.clearForTests();
}

function normalizeViewport(value: unknown): TimelineViewportPreference | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const dayWidthPx = toFiniteNonNegative(value.dayWidthPx);
  const scrollLeftPx = toFiniteNonNegative(value.scrollLeftPx);
  const scrollTopPx = toFiniteNonNegative(value.scrollTopPx);
  if (dayWidthPx === null || scrollLeftPx === null || scrollTopPx === null) {
    return null;
  }

  return {
    dayWidthPx,
    scrollLeftPx,
    scrollTopPx
  };
}

function toFiniteNonNegative(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value >= 0 ? value : 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
