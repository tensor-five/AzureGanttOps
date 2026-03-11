import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch
} from "../../shared/user-preferences/user-preferences.client.js";

const STORAGE_KEY = "azure-ganttops.timeline-details-width-px.v1";
const MIN_WIDTH_PX = 0;
const MAX_WIDTH_PX = 900;

let memoryDetailsWidthPx: number | null = null;
let hydrationStarted = false;

export function loadLastTimelineDetailsWidthPx(): number | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage !== null) {
    memoryDetailsWidthPx = fromStorage;
    return fromStorage;
  }

  const fromCache = sanitizeWidthPx(getCachedUserPreferences().timelineDetailsWidthPx);
  if (fromCache !== null) {
    memoryDetailsWidthPx = fromCache;
    writeToLocalStorage(fromCache);
    return fromCache;
  }

  return memoryDetailsWidthPx;
}

export function saveTimelineDetailsWidthPx(widthPx: number): void {
  const sanitized = sanitizeWidthPx(widthPx);
  if (sanitized === null) {
    return;
  }

  memoryDetailsWidthPx = sanitized;
  writeToLocalStorage(sanitized);
  persistUserPreferencesPatch({
    timelineDetailsWidthPx: sanitized
  });
}

export function hydrateTimelineDetailsWidthPreference(onHydrated?: (widthPx: number) => void): void {
  if (hydrationStarted) {
    return;
  }

  hydrationStarted = true;
  void hydrateUserPreferences().then((preferences) => {
    const widthPx = sanitizeWidthPx(preferences.timelineDetailsWidthPx);
    if (widthPx === null) {
      return;
    }

    memoryDetailsWidthPx = widthPx;
    writeToLocalStorage(widthPx);
    onHydrated?.(widthPx);
  });
}

export function clearTimelineDetailsWidthPreferenceForTests(): void {
  memoryDetailsWidthPx = null;
  hydrationStarted = false;

  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }
}

function readFromLocalStorage(): number | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  return sanitizeWidthPx(Number(raw));
}

function writeToLocalStorage(widthPx: number): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, String(widthPx));
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
