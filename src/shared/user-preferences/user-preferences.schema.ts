export type ThemeModePreference = "system" | "light" | "dark";
export type TimelineDensityPreference = "comfortable" | "compact";
export type TimelineColorCodingPreference = "none" | "person" | "status" | "parent" | "overdue" | "field";

export type TimelineFieldColorCodingPreference = {
  fieldRef?: string;
  valueColors?: Record<string, string>;
};

export type TimelineLabelFieldPreference = string;
export type SavedQueryPreference = {
  id: string;
  name: string;
  queryInput: string;
  organization?: string;
  project?: string;
};

export type UserPreferences = {
  themeMode?: ThemeModePreference;
  timelineDensity?: TimelineDensityPreference;
  timelineColorCoding?: TimelineColorCodingPreference;
  timelineFieldColorCoding?: TimelineFieldColorCodingPreference;
  timelineLabelFields?: TimelineLabelFieldPreference[];
  timelineSidebarFields?: TimelineLabelFieldPreference[];
  timelineSidebarWidthPx?: number;
  timelineDetailsWidthPx?: number;
  savedQueries?: SavedQueryPreference[];
  selectedHeaderQueryId?: string;
  filters?: Record<string, unknown>;
  views?: Record<string, unknown>;
  updatedAt?: string;
};

export function sanitizeUserPreferences(value: unknown): UserPreferences {
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
      Object.entries(valueColorsRaw).forEach(([key, entry]) => {
        if (typeof entry !== "string") {
          return;
        }

        const normalized = entry.trim();
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
    next.timelineLabelFields = normalized;
  }

  if (Array.isArray(candidate.timelineSidebarFields)) {
    const normalized = [...new Set(candidate.timelineSidebarFields)]
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    next.timelineSidebarFields = normalized;
  }

  if (typeof candidate.timelineSidebarWidthPx === "number" && Number.isFinite(candidate.timelineSidebarWidthPx)) {
    next.timelineSidebarWidthPx = clamp(Math.round(candidate.timelineSidebarWidthPx), 160, 640);
  }

  if (typeof candidate.timelineDetailsWidthPx === "number" && Number.isFinite(candidate.timelineDetailsWidthPx)) {
    next.timelineDetailsWidthPx = clamp(Math.round(candidate.timelineDetailsWidthPx), 0, 900);
  }

  if (Array.isArray(candidate.savedQueries)) {
    const deduped = new Map<string, SavedQueryPreference>();
    candidate.savedQueries.forEach((entry) => {
      const normalized = sanitizeSavedQueryPreference(entry);
      if (!normalized || deduped.has(normalized.id)) {
        return;
      }

      deduped.set(normalized.id, normalized);
    });

    next.savedQueries = deduped.size > 0 ? [...deduped.values()] : undefined;
  }

  if (typeof candidate.selectedHeaderQueryId === "string") {
    const selectedHeaderQueryId = candidate.selectedHeaderQueryId.trim();
    next.selectedHeaderQueryId = selectedHeaderQueryId.length > 0 ? selectedHeaderQueryId : undefined;
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

export function sanitizeSavedQueryPreference(value: unknown): SavedQueryPreference | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const queryInput = typeof value.queryInput === "string" ? value.queryInput.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const organization = typeof value.organization === "string" ? value.organization.trim() : "";
  const project = typeof value.project === "string" ? value.project.trim() : "";

  if (!id || !queryInput) {
    return null;
  }

  return {
    id,
    name: name.length > 0 ? name : id,
    queryInput,
    organization: organization.length > 0 ? organization : undefined,
    project: project.length > 0 ? project : undefined
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
