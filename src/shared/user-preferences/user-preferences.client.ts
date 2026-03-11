import { sanitizeUserPreferences, type UserPreferences } from "./user-preferences.schema.js";

export type {
  SavedQueryPreference,
  ThemeModePreference,
  TimelineColorCodingPreference,
  TimelineDensityPreference,
  TimelineFieldColorCodingPreference,
  TimelineLabelFieldPreference,
  UserPreferences
} from "./user-preferences.schema.js";

const USER_PREFERENCES_ENDPOINT = "/phase2/user-preferences";

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

  await fetch(USER_PREFERENCES_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      preferences: patch
    })
  });
}
