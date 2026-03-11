import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch
} from "../../shared/user-preferences/user-preferences.client.js";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-width-px.v1";
const MIN_WIDTH_PX = 160;
const MAX_WIDTH_PX = 640;

let memorySidebarWidthPx: number | null = null;
let hydrationStarted = false;

export function loadLastTimelineSidebarWidthPx(): number | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage !== null) {
    memorySidebarWidthPx = fromStorage;
    return fromStorage;
  }

  const fromCache = sanitizeWidthPx(getCachedUserPreferences().timelineSidebarWidthPx);
  if (fromCache !== null) {
    memorySidebarWidthPx = fromCache;
    writeToLocalStorage(fromCache);
    return fromCache;
  }

  return memorySidebarWidthPx;
}

export function saveTimelineSidebarWidthPx(widthPx: number): void {
  const sanitized = sanitizeWidthPx(widthPx);
  if (sanitized === null) {
    return;
  }

  memorySidebarWidthPx = sanitized;
  writeToLocalStorage(sanitized);
  persistUserPreferencesPatch({
    timelineSidebarWidthPx: sanitized
  });
}

export function hydrateTimelineSidebarWidthPreference(onHydrated?: (widthPx: number) => void): void {
  if (hydrationStarted) {
    return;
  }

  hydrationStarted = true;
  void hydrateUserPreferences().then((preferences) => {
    const widthPx = sanitizeWidthPx(preferences.timelineSidebarWidthPx);
    if (widthPx === null) {
      return;
    }

    memorySidebarWidthPx = widthPx;
    writeToLocalStorage(widthPx);
    onHydrated?.(widthPx);
  });
}

export function clearTimelineSidebarWidthPreferenceForTests(): void {
  memorySidebarWidthPx = null;
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
