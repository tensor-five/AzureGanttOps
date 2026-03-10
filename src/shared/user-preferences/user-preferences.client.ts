export type ThemeModePreference = "system" | "light" | "dark";
export type TimelineDensityPreference = "comfortable" | "compact";
export type TimelineColorCodingPreference = "none" | "person" | "status" | "parent" | "overdue" | "field";

export type TimelineFieldColorCodingPreference = {
  fieldRef?: string;
  valueColors?: Record<string, string>;
};

export type TimelineLabelFieldPreference = string;

export type UserPreferences = {
  themeMode?: ThemeModePreference;
  timelineDensity?: TimelineDensityPreference;
  timelineColorCoding?: TimelineColorCodingPreference;
  timelineFieldColorCoding?: TimelineFieldColorCodingPreference;
  timelineLabelFields?: TimelineLabelFieldPreference[];
  filters?: Record<string, unknown>;
  views?: Record<string, unknown>;
  updatedAt?: string;
};

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
  const sanitizedPatch = sanitizePreferences(patch);
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
  return sanitizePreferences(payload.preferences);
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

function sanitizePreferences(value: unknown): UserPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const next: UserPreferences = {};

  if (candidate.themeMode === "system" || candidate.themeMode === "light" || candidate.themeMode === "dark") {
    next.themeMode = candidate.themeMode;
  }

  if (candidate.timelineDensity === "comfortable" || candidate.timelineDensity === "compact") {
    next.timelineDensity = candidate.timelineDensity;
  }

  if (
    candidate.timelineColorCoding === "none" ||
    candidate.timelineColorCoding === "person" ||
    candidate.timelineColorCoding === "status" ||
    candidate.timelineColorCoding === "parent" ||
    candidate.timelineColorCoding === "overdue" ||
    candidate.timelineColorCoding === "field"
  ) {
    next.timelineColorCoding = candidate.timelineColorCoding;
  }

  if (isPlainRecord(candidate.timelineFieldColorCoding)) {
    const raw = candidate.timelineFieldColorCoding as Record<string, unknown>;
    const fieldRef = typeof raw.fieldRef === "string" ? raw.fieldRef.trim() : "";
    const valueColorsRaw = isPlainRecord(raw.valueColors) ? raw.valueColors : null;
    const valueColors: Record<string, string> = {};

    if (valueColorsRaw) {
      Object.entries(valueColorsRaw).forEach(([key, value]) => {
        if (typeof value !== "string") {
          return;
        }

        const normalized = value.trim();
        if (/^#[0-9a-f]{6}$/i.test(normalized)) {
          valueColors[key] = normalized.toLowerCase();
        }
      });
    }

    next.timelineFieldColorCoding = {
      fieldRef: fieldRef.length > 0 ? fieldRef : undefined,
      valueColors: Object.keys(valueColors).length > 0 ? valueColors : undefined
    };
  }

  if (Array.isArray(candidate.timelineLabelFields)) {
    const normalized = [...new Set(candidate.timelineLabelFields)]
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    next.timelineLabelFields = normalized.length > 0 ? normalized : undefined;
  }

  if (isPlainRecord(candidate.filters)) {
    next.filters = candidate.filters;
  }

  if (isPlainRecord(candidate.views)) {
    next.views = candidate.views;
  }

  if (typeof candidate.updatedAt === "string") {
    next.updatedAt = candidate.updatedAt;
  }

  return next;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
