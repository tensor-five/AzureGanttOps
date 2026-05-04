const QUERY_PROFILE_KEY = "azure-ganttops.query-profile-map";

export function persistQueryMappingSelection(queryId: string, profileId: string): void {
  const map = readMap();
  map[queryId] = profileId;
  writeMap(map);
}

export function readPersistedQueryMappingSelection(queryId: string): string | undefined {
  const map = readMap();
  return map[queryId];
}

function readMap(): Record<string, string> {
  if (typeof localStorage === "undefined") {
    return {};
  }

  const raw = localStorage.getItem(QUERY_PROFILE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const result: Record<string, string> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "string") {
        result[key] = value;
      }
    });
    return result;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(QUERY_PROFILE_KEY, JSON.stringify(map));
}
