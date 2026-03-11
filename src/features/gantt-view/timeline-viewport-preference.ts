import { createUserPreferenceStore } from "./create-user-preference-store.js";

export type TimelineViewportPreference = {
  dayWidthPx: number;
  scrollLeftPx: number;
  scrollTopPx: number;
};

const STORAGE_KEY = "azure-ganttops.timeline-viewport";
const VIEW_KEY = "timelineViewport";

const store = createUserPreferenceStore<TimelineViewportPreference>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => readFromViews(preferences.views),
  sanitize: normalizeViewport,
  buildPatch: (viewport, cachedPreferences) => {
    const cachedViews = cachedPreferences.views;
    const baseViews = isPlainRecord(cachedViews) ? cachedViews : {};
    return {
      views: {
        ...baseViews,
        [VIEW_KEY]: viewport
      }
    };
  }
});

export function loadLastTimelineViewportPreference(): TimelineViewportPreference | null {
  return store.load();
}

export function saveTimelineViewportPreference(viewport: TimelineViewportPreference): void {
  store.save(viewport);
}

export function hydrateTimelineViewportPreference(onHydrated?: (viewport: TimelineViewportPreference) => void): void {
  store.hydrate(onHydrated);
}

export function clearTimelineViewportPreferenceForTests(): void {
  store.clearForTests();
}

function readFromViews(views: unknown): TimelineViewportPreference | null {
  if (!isPlainRecord(views)) {
    return null;
  }

  const candidate = views[VIEW_KEY];
  return normalizeViewport(candidate);
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
