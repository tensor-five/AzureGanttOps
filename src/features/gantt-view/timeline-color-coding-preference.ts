export type TimelineColorCoding = "none" | "person" | "status" | "parent" | "overdue";

const STORAGE_KEY = "azure-ganttops.timeline-color-coding";

let memoryColorCoding: TimelineColorCoding | null = null;

export function loadLastTimelineColorCoding(): TimelineColorCoding | null {
  const fromStorage = readFromLocalStorage();
  if (fromStorage) {
    memoryColorCoding = fromStorage;
    return fromStorage;
  }

  return memoryColorCoding;
}

export function saveLastTimelineColorCoding(mode: TimelineColorCoding): void {
  memoryColorCoding = mode;
  writeToLocalStorage(mode);
}

export function clearTimelineColorCodingPreferenceForTests(): void {
  memoryColorCoding = null;

  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }
}

function readFromLocalStorage(): TimelineColorCoding | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  const value = globalThis.localStorage.getItem(STORAGE_KEY);
  if (value === "none" || value === "person" || value === "status" || value === "parent" || value === "overdue") {
    return value;
  }

  return null;
}

function writeToLocalStorage(mode: TimelineColorCoding): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, mode);
}
