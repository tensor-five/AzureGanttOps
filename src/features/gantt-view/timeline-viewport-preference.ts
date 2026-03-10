import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch
} from "../../shared/user-preferences/user-preferences.client.js";

export type TimelineViewportPreference = {
  dayWidthPx: number;
  scrollLeftPx: number;
  scrollTopPx: number;
};

const STORAGE_KEY = "azure-ganttops.timeline-viewport";
const VIEW_KEY = "timelineViewport";

let memoryViewport: TimelineViewportPreference | null = null;
let hydrationStarted = false;

export function loadLastTimelineViewportPreference(): TimelineViewportPreference | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    memoryViewport = fromStorage;
    return fromStorage;
  }

  const fromCache = readFromViews(getCachedUserPreferences().views);
  if (fromCache) {
    memoryViewport = fromCache;
    writeToLocalStorage(fromCache);
    return fromCache;
  }

  return memoryViewport;
}

export function saveTimelineViewportPreference(viewport: TimelineViewportPreference): void {
  const normalized = normalizeViewport(viewport);
  if (!normalized) {
    return;
  }

  memoryViewport = normalized;
  writeToLocalStorage(normalized);

  const cachedViews = getCachedUserPreferences().views;
  const baseViews = isPlainRecord(cachedViews) ? cachedViews : {};
  persistUserPreferencesPatch({
    views: {
      ...baseViews,
      [VIEW_KEY]: normalized
    }
  });
}

export function hydrateTimelineViewportPreference(onHydrated?: (viewport: TimelineViewportPreference) => void): void {
  if (hydrationStarted) {
    return;
  }

  hydrationStarted = true;
  void hydrateUserPreferences().then((preferences) => {
    const viewport = readFromViews(preferences.views);
    if (!viewport) {
      return;
    }

    memoryViewport = viewport;
    writeToLocalStorage(viewport);
    onHydrated?.(viewport);
  });
}

export function clearTimelineViewportPreferenceForTests(): void {
  memoryViewport = null;
  hydrationStarted = false;

  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }
}

function readFromViews(views: unknown): TimelineViewportPreference | null {
  if (!isPlainRecord(views)) {
    return null;
  }

  const candidate = views[VIEW_KEY];
  return normalizeViewport(candidate);
}

function readFromLocalStorage(): TimelineViewportPreference | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeViewport(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeToLocalStorage(viewport: TimelineViewportPreference): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(viewport));
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
