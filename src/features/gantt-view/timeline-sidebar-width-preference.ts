import { createUserPreferenceStore } from "./create-user-preference-store.js";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-width-px.v1";
const MIN_WIDTH_PX = 160;
const MAX_WIDTH_PX = 640;

const store = createUserPreferenceStore<number>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineSidebarWidthPx,
  sanitize: sanitizeWidthPx,
  buildPatch: (widthPx) => ({
    timelineSidebarWidthPx: widthPx
  }),
  serialize: (widthPx) => String(widthPx),
  deserialize: (raw) => Number(raw)
});

export function loadLastTimelineSidebarWidthPx(): number | null {
  return store.load();
}

export function saveTimelineSidebarWidthPx(widthPx: number): void {
  store.save(widthPx);
}

export function hydrateTimelineSidebarWidthPreference(onHydrated?: (widthPx: number) => void): void {
  store.hydrate(onHydrated);
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
