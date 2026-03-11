import { createUserPreferenceStore } from "./create-user-preference-store.js";

const STORAGE_KEY = "azure-ganttops.timeline-details-width-px.v1";
const MIN_WIDTH_PX = 0;
const MAX_WIDTH_PX = 900;

const store = createUserPreferenceStore<number>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineDetailsWidthPx,
  sanitize: sanitizeWidthPx,
  buildPatch: (widthPx) => ({
    timelineDetailsWidthPx: widthPx
  }),
  serialize: (widthPx) => String(widthPx),
  deserialize: (raw) => Number(raw)
});

export function loadLastTimelineDetailsWidthPx(): number | null {
  return store.load();
}

export function saveTimelineDetailsWidthPx(widthPx: number): void {
  store.save(widthPx);
}

export function hydrateTimelineDetailsWidthPreference(onHydrated?: (widthPx: number) => void): void {
  store.hydrate(onHydrated);
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
