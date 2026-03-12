import type {
  QueryScopedTimelinePreferences,
  UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";

export type QueryScopedTimelinePreferenceKey = keyof QueryScopedTimelinePreferences;

export function readQueryScopedTimelinePreference(
  preferences: UserPreferences,
  scopeKey: string | null,
  key: QueryScopedTimelinePreferenceKey
): unknown {
  if (scopeKey) {
    return preferences.queryScopedTimelinePreferencesByQueryId?.[scopeKey]?.[key];
  }

  return preferences[key as keyof UserPreferences];
}

export function buildQueryScopedTimelinePreferencePatch<T>(params: {
  key: QueryScopedTimelinePreferenceKey;
  value: T;
  cachedPreferences: UserPreferences;
  scopeKey: string | null;
}): Partial<UserPreferences> {
  const { key, value, cachedPreferences, scopeKey } = params;

  if (!scopeKey) {
    return {
      [key]: value
    } as Partial<UserPreferences>;
  }

  const current = cachedPreferences.queryScopedTimelinePreferencesByQueryId;
  const nextByQueryId = isPlainRecord(current) ? { ...current } : {};
  const existingForQuery = isPlainRecord(nextByQueryId[scopeKey]) ? nextByQueryId[scopeKey] : {};

  nextByQueryId[scopeKey] = {
    ...existingForQuery,
    [key]: value
  };

  return {
    queryScopedTimelinePreferencesByQueryId: nextByQueryId
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
