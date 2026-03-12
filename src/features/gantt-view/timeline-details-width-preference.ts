import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

const STORAGE_KEY = "azure-ganttops.timeline-details-width-px.v1";
const MIN_WIDTH_PX = 0;
const MAX_WIDTH_PX = 900;

const store = createUserPreferenceStore<number>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineDetailsWidthPx"),
  sanitize: sanitizeWidthPx,
  buildPatch: (widthPx, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineDetailsWidthPx",
      value: widthPx,
      cachedPreferences,
      scopeKey
    }),
  serialize: (widthPx) => String(widthPx),
  deserialize: (raw) => Number(raw)
});

export function loadLastTimelineDetailsWidthPx(queryId?: string | null): number | null {
  return store.load({ scopeKey: queryId });
}

export function saveTimelineDetailsWidthPx(widthPx: number, queryId?: string | null): void {
  store.save(widthPx, { scopeKey: queryId });
}

export function hydrateTimelineDetailsWidthPreference(onHydrated?: (widthPx: number) => void, queryId?: string | null): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
}

export function clearTimelineDetailsWidthPreferenceForTests(): void {
  store.clearForTests();
}

function sanitizeWidthPx(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return clamp(Math.round(value), MIN_WIDTH_PX, MAX_WIDTH_PX);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
