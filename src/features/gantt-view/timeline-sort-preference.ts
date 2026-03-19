import { createUserPreferenceStore } from "./create-user-preference-store.js";
import {
  buildQueryScopedTimelinePreferencePatch,
  readQueryScopedTimelinePreference
} from "./query-scoped-timeline-preferences.js";

export type TimelineSortField =
  | "startDate"
  | "endDate"
  | "title"
  | "mappedId"
  | "state"
  | "assignedTo"
  | "parentWorkItemId"
  | `field:${string}`;

export type TimelineSortDirection = "asc" | "desc";

export type TimelineSortPreference = {
  primary: TimelineSortField;
  primaryDirection: TimelineSortDirection;
  secondary: TimelineSortField | null;
  secondaryDirection: TimelineSortDirection;
};

export const DEFAULT_TIMELINE_SORT_PREFERENCE: TimelineSortPreference = {
  primary: "startDate",
  primaryDirection: "asc",
  secondary: null,
  secondaryDirection: "asc"
};

const STORAGE_KEY = "azure-ganttops.timeline-sort.v1";

const store = createUserPreferenceStore<TimelineSortPreference>({
  storageKey: STORAGE_KEY,
  readFromServerCache: (preferences, scopeKey) =>
    readQueryScopedTimelinePreference(preferences, scopeKey, "timelineSort"),
  sanitize: sanitizeTimelineSortPreference,
  buildPatch: (preference, cachedPreferences, scopeKey) =>
    buildQueryScopedTimelinePreferencePatch({
      key: "timelineSort",
      value: {
        primary: preference.primary,
        primaryDirection: preference.primaryDirection,
        secondary: preference.secondary,
        secondaryDirection: preference.secondaryDirection
      },
      cachedPreferences,
      scopeKey
    })
});

export function loadLastTimelineSortPreference(queryId?: string | null): TimelineSortPreference | null {
  return store.load({ scopeKey: queryId });
}

export function saveTimelineSortPreference(preference: TimelineSortPreference, queryId?: string | null): void {
  const sanitized = sanitizeTimelineSortPreference(preference) ?? DEFAULT_TIMELINE_SORT_PREFERENCE;
  store.save(sanitized, { scopeKey: queryId });
}

export function hydrateTimelineSortPreference(
  onHydrated?: (preference: TimelineSortPreference) => void,
  queryId?: string | null
): void {
  store.hydrate(onHydrated, { scopeKey: queryId });
}

export function clearTimelineSortPreferenceForTests(): void {
  store.clearForTests();
}

export function sanitizeTimelineSortPreference(value: unknown): TimelineSortPreference | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const primary = sanitizeTimelineSortField(candidate.primary);
  if (!primary) {
    return null;
  }

  const secondaryRaw = candidate.secondary;
  const secondary = secondaryRaw === null ? null : sanitizeTimelineSortField(secondaryRaw);
  if (secondaryRaw !== null && typeof secondaryRaw !== "undefined" && !secondary) {
    return null;
  }

  if (secondary === primary) {
    return {
      primary,
      primaryDirection: sanitizeTimelineSortDirection(candidate.primaryDirection) ?? "asc",
      secondary: primary === "startDate" ? null : "startDate",
      secondaryDirection: sanitizeTimelineSortDirection(candidate.secondaryDirection) ?? "asc"
    };
  }

  return {
    primary,
    primaryDirection: sanitizeTimelineSortDirection(candidate.primaryDirection) ?? "asc",
    secondary: secondary ?? null,
    secondaryDirection: sanitizeTimelineSortDirection(candidate.secondaryDirection) ?? "asc"
  };
}

export function sanitizeTimelineSortField(value: unknown): TimelineSortField | null {
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
  if (fieldRef.length === 0) {
    return null;
  }

  return `field:${fieldRef}`;
}

export function sanitizeTimelineSortDirection(value: unknown): TimelineSortDirection | null {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return null;
}
