import {
  getCachedUserPreferences,
  hydrateUserPreferences,
  persistUserPreferencesPatch
} from "../../shared/user-preferences/user-preferences.client.js";

export type TimelineDensity = "comfortable" | "compact";

const STORAGE_KEY = "azure-ganttops.timeline-density";

let memoryDensity: TimelineDensity | null = null;
let hydrationStarted = false;

export function loadLastDensity(): TimelineDensity | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    memoryDensity = fromStorage;
    return fromStorage;
  }

  const fromCache = getCachedUserPreferences().timelineDensity;
  if (fromCache) {
    memoryDensity = fromCache;
    writeToLocalStorage(fromCache);
    return fromCache;
  }

  return memoryDensity;
}

export function saveLastDensity(density: TimelineDensity): void {
  memoryDensity = density;
  writeToLocalStorage(density);
  persistUserPreferencesPatch({
    timelineDensity: density
  });
}

export function hydrateTimelineDensityPreference(onHydrated?: (density: TimelineDensity) => void): void {
  if (hydrationStarted) {
    return;
  }

  hydrationStarted = true;
  void hydrateUserPreferences().then((preferences) => {
    const density = preferences.timelineDensity;
    if (!density) {
      return;
    }

    memoryDensity = density;
    writeToLocalStorage(density);
    onHydrated?.(density);
  });
}

export function clearTimelineDensityPreferenceForTests(): void {
  memoryDensity = null;
  hydrationStarted = false;

  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }
}

function readFromLocalStorage(): TimelineDensity | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  const value = globalThis.localStorage.getItem(STORAGE_KEY);
  if (value === "comfortable" || value === "compact") {
    return value;
  }

  return null;
}

function writeToLocalStorage(density: TimelineDensity): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, density);
}
