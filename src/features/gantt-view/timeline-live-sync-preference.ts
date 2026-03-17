import { createUserPreferenceStore } from "./create-user-preference-store.js";

const STORAGE_KEY = "azure-ganttops.timeline-live-sync-enabled";

const store = createUserPreferenceStore<boolean>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineLiveSyncEnabled,
  sanitize: (value) => (typeof value === "boolean" ? value : null),
  buildPatch: (enabled) => ({
    timelineLiveSyncEnabled: enabled
  }),
  serialize: (enabled) => (enabled ? "true" : "false"),
  deserialize: (raw) => raw
});

export function loadTimelineLiveSyncEnabledPreference(): boolean {
  return store.load() ?? true;
}

export function saveTimelineLiveSyncEnabledPreference(enabled: boolean): void {
  store.save(enabled);
}

export function hydrateTimelineLiveSyncEnabledPreference(onHydrated?: (enabled: boolean) => void): void {
  store.hydrate(onHydrated);
}

export function clearTimelineLiveSyncEnabledPreferenceForTests(): void {
  store.clearForTests();
}
