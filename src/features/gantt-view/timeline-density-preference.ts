import { createUserPreferenceStore } from "./create-user-preference-store.js";

export type TimelineDensity = "comfortable" | "compact";

const STORAGE_KEY = "azure-ganttops.timeline-density";

const store = createUserPreferenceStore<TimelineDensity>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineDensity,
  sanitize: (value) => (value === "comfortable" || value === "compact" ? value : null),
  buildPatch: (density) => ({
    timelineDensity: density
  }),
  serialize: (density) => density,
  deserialize: (raw) => raw
});

export function loadLastDensity(): TimelineDensity | null {
  return store.load();
}

export function saveLastDensity(density: TimelineDensity): void {
  store.save(density);
}

export function hydrateTimelineDensityPreference(onHydrated?: (density: TimelineDensity) => void): void {
  store.hydrate(onHydrated);
}

export function clearTimelineDensityPreferenceForTests(): void {
  store.clearForTests();
}
