import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-width-px.v1";
const MIN_WIDTH_PX = 160;
const MAX_WIDTH_PX = 640;

const store = createUserPreferenceStore<number>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineSidebarWidthPx"),
  sanitize: sanitizeWidthPx,
  buildPatch: (widthPx, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineSidebarWidthPx",
      value: widthPx,
      cachedPreferences,
      scopeKey
    }),
  serialize: (widthPx) => String(widthPx),
  deserialize: (raw) => Number(raw)
});

export function loadLastTimelineSidebarWidthPx(queryId?: string | null): number | null {
  return store.load({ scopeKey: queryId });
}

export function saveTimelineSidebarWidthPx(widthPx: number, queryId?: string | null): void {
  store.save(widthPx, { scopeKey: queryId });
}

export function hydrateTimelineSidebarWidthPreference(onHydrated?: (widthPx: number) => void, queryId?: string | null): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
}

export function clearTimelineSidebarWidthPreferenceForTests(): void {
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
