export type ThemeModePreference = "system" | "light" | "dark";
export type TimelineDensityPreference = "comfortable" | "compact";
export type TimelineColorCodingPreference = "none" | "status" | "parent" | "overdue" | "field";
export type TimelineSidebarRowJustifyPreference = "flex-start" | "flex-end";

export type TimelineFieldColorCodingPreference = {
  fieldRef?: string;
  valueColors?: Record<string, string>;
  overdueExcludedStateCodes?: string[];
};

export type TimelineLabelFieldPreference = string;
export type TimelineSortPreference = {
  primary?: string;
  primaryDirection?: "asc" | "desc";
  secondary?: string | null;
  secondaryDirection?: "asc" | "desc";
};
export type QueryScopedTimelinePreferences = {
  timelineDensity?: TimelineDensityPreference;
  timelineColorCoding?: TimelineColorCodingPreference;
  timelineFieldColorCoding?: TimelineFieldColorCodingPreference;
  timelineLabelFields?: TimelineLabelFieldPreference[];
  timelineSidebarFields?: TimelineLabelFieldPreference[];
  timelineSort?: TimelineSortPreference;
  timelineSidebarWidthPx?: number;
  timelineDetailsWidthPx?: number;
  timelineSidebarRowJustify?: TimelineSidebarRowJustifyPreference;
  timelineViewport?: {
    dayWidthPx: number;
    scrollLeftPx: number;
    scrollTopPx: number;
  };
};

export type QueryScopedTimelinePreferencesByQueryId = Record<string, QueryScopedTimelinePreferences>;
export type SavedQueryPreference = {
  id: string;
  name: string;
  queryInput: string;
  organization?: string;
  project?: string;
};

export type UserPreferences = {
  themeMode?: ThemeModePreference;
  timelineLiveSyncEnabled?: boolean;
  timelineDensity?: TimelineDensityPreference;
  timelineColorCoding?: TimelineColorCodingPreference;
  timelineFieldColorCoding?: TimelineFieldColorCodingPreference;
  timelineLabelFields?: TimelineLabelFieldPreference[];
  timelineSidebarFields?: TimelineLabelFieldPreference[];
  timelineSort?: TimelineSortPreference;
  timelineSidebarWidthPx?: number;
  timelineDetailsWidthPx?: number;
  timelineSidebarRowJustify?: TimelineSidebarRowJustifyPreference;
  queryScopedTimelinePreferencesByQueryId?: QueryScopedTimelinePreferencesByQueryId;
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

  if (typeof candidate.timelineLiveSyncEnabled === "boolean") {
    next.timelineLiveSyncEnabled = candidate.timelineLiveSyncEnabled;
  }

  if (candidate.timelineDensity === "comfortable" || candidate.timelineDensity === "compact") {
    next.timelineDensity = candidate.timelineDensity;
  }

  if (
    candidate.timelineColorCoding === "none" ||
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
    const overdueExcludedStateCodesRaw = Array.isArray(raw.overdueExcludedStateCodes) ? raw.overdueExcludedStateCodes : null;
    const valueColors: Record<string, string> = {};
    const overdueExcludedStateCodes = overdueExcludedStateCodesRaw
      ? [...new Set(overdueExcludedStateCodesRaw)]
          .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
          .filter((entry) => entry.length > 0)
      : undefined;

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
      valueColors: Object.keys(valueColors).length > 0 ? valueColors : undefined,
      ...(overdueExcludedStateCodes ? { overdueExcludedStateCodes } : {})
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

  if (isPlainRecord(candidate.timelineSort)) {
    const raw = candidate.timelineSort as Record<string, unknown>;
    const primary = sanitizeTimelineSortField(raw.primary);
    const secondaryRaw = raw.secondary;
    const secondary =
      secondaryRaw === null
        ? null
        : typeof secondaryRaw === "undefined"
          ? undefined
          : sanitizeTimelineSortField(secondaryRaw);

    if (primary && (secondaryRaw === null || typeof secondaryRaw === "undefined" || secondary)) {
      const primaryDirection = sanitizeTimelineSortDirection(raw.primaryDirection) ?? "asc";
      const secondaryDirection = sanitizeTimelineSortDirection(raw.secondaryDirection) ?? "asc";
      next.timelineSort = {
        primary,
        primaryDirection,
        secondary,
        secondaryDirection
      };
    }
  }

  if (typeof candidate.timelineSidebarWidthPx === "number" && Number.isFinite(candidate.timelineSidebarWidthPx)) {
    next.timelineSidebarWidthPx = clamp(Math.round(candidate.timelineSidebarWidthPx), 160, 640);
  }

  if (typeof candidate.timelineDetailsWidthPx === "number" && Number.isFinite(candidate.timelineDetailsWidthPx)) {
    next.timelineDetailsWidthPx = clamp(Math.round(candidate.timelineDetailsWidthPx), 0, 900);
  }

  if (candidate.timelineSidebarRowJustify === "flex-start" || candidate.timelineSidebarRowJustify === "flex-end") {
    next.timelineSidebarRowJustify = candidate.timelineSidebarRowJustify;
  }

  if (isPlainRecord(candidate.queryScopedTimelinePreferencesByQueryId)) {
    const normalizedByQueryId: QueryScopedTimelinePreferencesByQueryId = {};
    Object.entries(candidate.queryScopedTimelinePreferencesByQueryId).forEach(([queryId, value]) => {
      const normalizedQueryId = normalizeQueryScopedKey(queryId);
      if (!normalizedQueryId || !isPlainRecord(value)) {
        return;
      }

      const scoped = sanitizeQueryScopedTimelinePreferences(value);
      if (Object.keys(scoped).length === 0) {
        return;
      }

      normalizedByQueryId[normalizedQueryId] = scoped;
    });

    next.queryScopedTimelinePreferencesByQueryId =
      Object.keys(normalizedByQueryId).length > 0 ? normalizedByQueryId : undefined;
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

function normalizeQueryScopedKey(value: string): string {
  return value.trim();
}

function sanitizeQueryScopedTimelinePreferences(value: Record<string, unknown>): QueryScopedTimelinePreferences {
  const next: QueryScopedTimelinePreferences = {};

  if (value.timelineDensity === "comfortable" || value.timelineDensity === "compact") {
    next.timelineDensity = value.timelineDensity;
  }

  if (
    value.timelineColorCoding === "none" ||
    value.timelineColorCoding === "status" ||
    value.timelineColorCoding === "parent" ||
    value.timelineColorCoding === "overdue" ||
    value.timelineColorCoding === "field"
  ) {
    next.timelineColorCoding = value.timelineColorCoding;
  }

  if (isPlainRecord(value.timelineFieldColorCoding)) {
    const raw = value.timelineFieldColorCoding as Record<string, unknown>;
    const fieldRef = typeof raw.fieldRef === "string" ? raw.fieldRef.trim() : "";
    const valueColorsRaw = isPlainRecord(raw.valueColors) ? raw.valueColors : null;
    const overdueExcludedStateCodesRaw = Array.isArray(raw.overdueExcludedStateCodes) ? raw.overdueExcludedStateCodes : null;
    const valueColors: Record<string, string> = {};
    const overdueExcludedStateCodes = overdueExcludedStateCodesRaw
      ? [...new Set(overdueExcludedStateCodesRaw)]
          .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
          .filter((entry) => entry.length > 0)
      : undefined;

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
      valueColors: Object.keys(valueColors).length > 0 ? valueColors : undefined,
      ...(overdueExcludedStateCodes ? { overdueExcludedStateCodes } : {})
    };
  }

  if (Array.isArray(value.timelineLabelFields)) {
    const normalized = [...new Set(value.timelineLabelFields)]
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    next.timelineLabelFields = normalized;
  }

  if (Array.isArray(value.timelineSidebarFields)) {
    const normalized = [...new Set(value.timelineSidebarFields)]
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    next.timelineSidebarFields = normalized;
  }

  if (isPlainRecord(value.timelineSort)) {
    const raw = value.timelineSort as Record<string, unknown>;
    const primary = sanitizeTimelineSortField(raw.primary);
    const secondaryRaw = raw.secondary;
    const secondary =
      secondaryRaw === null
        ? null
        : typeof secondaryRaw === "undefined"
          ? undefined
          : sanitizeTimelineSortField(secondaryRaw);

    if (primary && (secondaryRaw === null || typeof secondaryRaw === "undefined" || secondary)) {
      const primaryDirection = sanitizeTimelineSortDirection(raw.primaryDirection) ?? "asc";
      const secondaryDirection = sanitizeTimelineSortDirection(raw.secondaryDirection) ?? "asc";
      next.timelineSort = {
        primary,
        primaryDirection,
        secondary,
        secondaryDirection
      };
    }
  }

  if (typeof value.timelineSidebarWidthPx === "number" && Number.isFinite(value.timelineSidebarWidthPx)) {
    next.timelineSidebarWidthPx = clamp(Math.round(value.timelineSidebarWidthPx), 160, 640);
  }

  if (typeof value.timelineDetailsWidthPx === "number" && Number.isFinite(value.timelineDetailsWidthPx)) {
    next.timelineDetailsWidthPx = clamp(Math.round(value.timelineDetailsWidthPx), 0, 900);
  }

  if (value.timelineSidebarRowJustify === "flex-start" || value.timelineSidebarRowJustify === "flex-end") {
    next.timelineSidebarRowJustify = value.timelineSidebarRowJustify;
  }

  const timelineViewport = sanitizeTimelineViewportPreference(value.timelineViewport);
  if (timelineViewport) {
    next.timelineViewport = timelineViewport;
  }

  return next;
}

function sanitizeTimelineViewportPreference(value: unknown): QueryScopedTimelinePreferences["timelineViewport"] | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const dayWidthPx = toFiniteNonNegative(value.dayWidthPx);
  const scrollLeftPx = toFiniteNonNegative(value.scrollLeftPx);
  const scrollTopPx = toFiniteNonNegative(value.scrollTopPx);
  if (dayWidthPx === null || scrollLeftPx === null || scrollTopPx === null) {
    return null;
  }

  return {
    dayWidthPx,
    scrollLeftPx,
    scrollTopPx
  };
}

function toFiniteNonNegative(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value >= 0 ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sanitizeTimelineSortField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (
    normalized === "startDate" ||
    normalized === "endDate" ||
    normalized === "title" ||
    normalized === "mappedId" ||
    normalized === "state" ||
    normalized === "assignedTo" ||
    normalized === "parentWorkItemId"
  ) {
    return normalized;
  }

  if (!normalized.startsWith("field:")) {
    return null;
  }

  const fieldRef = normalized.slice("field:".length).trim();
  return fieldRef.length > 0 ? `field:${fieldRef}` : null;
}

function sanitizeTimelineSortDirection(value: unknown): "asc" | "desc" | null {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return null;
}
