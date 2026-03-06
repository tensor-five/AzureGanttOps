export type TimelineDensity = "comfortable" | "compact";

const STORAGE_KEY = "azure-ganttops.timeline-density";

let memoryDensity: TimelineDensity | null = null;

export function loadLastDensity(): TimelineDensity | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    memoryDensity = fromStorage;
    return fromStorage;
  }

  return memoryDensity;
}

export function saveLastDensity(density: TimelineDensity): void {
  memoryDensity = density;
  writeToLocalStorage(density);
}

export function clearTimelineDensityPreferenceForTests(): void {
  memoryDensity = null;

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
