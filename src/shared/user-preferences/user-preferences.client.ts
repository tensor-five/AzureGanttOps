import { sanitizeUserPreferences, type UserPreferences } from "./user-preferences.schema.js";

export type {
  SavedQueryPreference,
  ThemeModePreference,
  TimelineColorCodingPreference,
  TimelineDensityPreference,
  TimelineFieldColorCodingPreference,
  TimelineLabelFieldPreference,
  TimelineSidebarRowJustifyPreference,
  UserPreferences
} from "./user-preferences.schema.js";

const USER_PREFERENCES_ENDPOINT = "/phase2/user-preferences";
const ADO_CSRF_META_SELECTOR = 'meta[name="ado-csrf-token"]';
const ADO_CSRF_HEADER = "x-ado-csrf-token";

let cachedPreferences: UserPreferences = {};
let hydrated = false;
let hydrationInFlight: Promise<UserPreferences> | null = null;

export function getCachedUserPreferences(): UserPreferences {
  return cachedPreferences;
}

export async function hydrateUserPreferences(): Promise<UserPreferences> {
  if (hydrated) {
    return cachedPreferences;
  }

  if (hydrationInFlight) {
    return hydrationInFlight;
  }

  hydrationInFlight = loadUserPreferencesFromServer()
    .then((next) => {
      cachedPreferences = next;
      hydrated = true;
      return cachedPreferences;
    })
    .catch(() => cachedPreferences)
    .finally(() => {
      hydrationInFlight = null;
    });

  return hydrationInFlight;
}

export function persistUserPreferencesPatch(patch: Partial<UserPreferences>): void {
  const sanitizedPatch = sanitizeUserPreferences(patch);
  cachedPreferences = {
    ...cachedPreferences,
    ...sanitizedPatch
  };

  void postUserPreferencesPatch(sanitizedPatch).catch(() => {
    // Keep local state even if the local server is not reachable.
  });
}

async function loadUserPreferencesFromServer(): Promise<UserPreferences> {
  if (typeof fetch === "undefined") {
    return cachedPreferences;
  }

  const response = await fetch(USER_PREFERENCES_ENDPOINT, {
    method: "GET",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    return cachedPreferences;
  }

  const payload = (await response.json()) as { preferences?: unknown };
  return sanitizeUserPreferences(payload.preferences);
}

async function postUserPreferencesPatch(patch: UserPreferences): Promise<void> {
  if (typeof fetch === "undefined") {
    return;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json"
  };
  const csrfToken = readCsrfTokenFromMeta();
  if (csrfToken) {
    headers[ADO_CSRF_HEADER] = csrfToken;
  }

  await fetch(USER_PREFERENCES_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      preferences: patch
    })
  });
}

function readCsrfTokenFromMeta(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const meta = document.querySelector(ADO_CSRF_META_SELECTOR);
  if (!(meta instanceof HTMLMetaElement)) {
    return null;
  }

  const token = meta.content.trim();
  return token.length > 0 ? token : null;
}
