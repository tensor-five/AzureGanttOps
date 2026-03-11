import { createUserPreferenceStore } from "./create-user-preference-store.js";

export type TimelineSidebarRowJustify = "flex-start" | "flex-end";

const STORAGE_KEY = "azure-ganttops.timeline-sidebar-row-justify.v1";

const store = createUserPreferenceStore<TimelineSidebarRowJustify>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.timelineSidebarRowJustify,
  sanitize: sanitizeTimelineSidebarRowJustify,
  buildPatch: (justify) => ({
    timelineSidebarRowJustify: justify
  }),
  serialize: (justify) => justify,
  deserialize: (raw) => raw
});

export function loadLastTimelineSidebarRowJustify(): TimelineSidebarRowJustify | null {
  return store.load();
}

export function saveTimelineSidebarRowJustify(justify: TimelineSidebarRowJustify): void {
  store.save(justify);
}

export function hydrateTimelineSidebarRowJustifyPreference(
  onHydrated?: (justify: TimelineSidebarRowJustify) => void
): void {
  store.hydrate(onHydrated);
}

export function clearTimelineSidebarRowJustifyPreferenceForTests(): void {
  store.clearForTests();
}

function sanitizeTimelineSidebarRowJustify(value: unknown): TimelineSidebarRowJustify | null {
  return value === "flex-start" || value === "flex-end" ? value : null;
}
