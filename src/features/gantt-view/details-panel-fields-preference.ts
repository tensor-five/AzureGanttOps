import { createUserPreferenceStore } from "./create-user-preference-store.js";

const STORAGE_KEY = "azure-ganttops.details-panel-fields.v1";

/** Global (not query-scoped) ordered list of field ids shown in the details panel (DPF-21). */
const store = createUserPreferenceStore<string[]>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences) => preferences.detailsPanelFields,
  sanitize: sanitizeDetailsPanelFields,
  buildPatch: (fieldIds) => ({ detailsPanelFields: fieldIds })
});

export function loadDetailsPanelFields(): string[] | null {
  return store.load();
}

export function saveDetailsPanelFields(fieldIds: string[]): void {
  store.save(sanitizeDetailsPanelFields(fieldIds) ?? []);
}

export function hydrateDetailsPanelFieldsPreference(onHydrated?: (fieldIds: string[]) => void): void {
  store.hydrate(onHydrated);
}

export function clearDetailsPanelFieldsPreferenceForTests(): void {
  store.clearForTests();
}

function sanitizeDetailsPanelFields(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return [...new Set(value.map((entry) => (typeof entry === "string" ? entry.trim() : "")))].filter(
    (entry) => entry.length > 0
  );
}
