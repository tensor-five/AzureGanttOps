import type { TabId } from "../../shared/ui-state/tab-id.js";

type QueryInputResolver = (queryInput: string, organization: string, project: string) => string | null;

export type PersistedUiShellState<TResponse, TRunRequest> = {
  activeTab: TabId;
  response: TResponse | null;
  lastRunRequest: TRunRequest | null;
};

const QUERY_GUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const QUERY_GUID_EXACT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolvePersistedRefreshQueryInput(params: {
  queryInputKey: string;
  orgKey: string;
  projectKey: string;
  resolveQueryRunInput: QueryInputResolver;
}): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const queryInput = localStorage.getItem(params.queryInputKey) ?? "";
  const organization = localStorage.getItem(params.orgKey) ?? "";
  const project = localStorage.getItem(params.projectKey) ?? "";
  return params.resolveQueryRunInput(queryInput, organization, project);
}

export function readPersistedQueryContext(params: {
  queryInputKey: string;
  orgKey: string;
  projectKey: string;
}): { queryInput: string; organization: string; project: string } {
  if (typeof localStorage === "undefined") {
    return {
      queryInput: "",
      organization: "",
      project: ""
    };
  }

  return {
    queryInput: localStorage.getItem(params.queryInputKey) ?? "",
    organization: localStorage.getItem(params.orgKey) ?? "",
    project: localStorage.getItem(params.projectKey) ?? ""
  };
}

export function inferSavedQueryId(queryInput: string): string {
  const match = queryInput.match(QUERY_GUID_PATTERN);
  return match ? match[0] : queryInput;
}

export function buildSavedQueryLabel(): string {
  return "Unbenannte Query";
}

export function toShortQueryName(name: string, id: string): string {
  const raw = name.trim();
  if (!raw) {
    return "Unbenannte Query";
  }

  const trailingGuidMatch = raw.match(/^(.*)\s\(([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\)$/i);
  const withoutTrailingGuid = trailingGuidMatch ? trailingGuidMatch[1].trim() : raw;

  if (!withoutTrailingGuid || QUERY_GUID_EXACT_PATTERN.test(withoutTrailingGuid) || withoutTrailingGuid === id) {
    return "Unbenannte Query";
  }

  const segments = withoutTrailingGuid.split("/").map((segment) => segment.trim()).filter(Boolean);
  const shortName = segments[segments.length - 1] ?? withoutTrailingGuid;
  return shortName || "Unbenannte Query";
}

export function upsertSavedQueries<T extends { id: string }>(queries: T[], candidate: T, maxEntries: number): T[] {
  const withoutCurrent = queries.filter((entry) => entry.id !== candidate.id);
  const next = [candidate, ...withoutCurrent];
  return next.slice(0, maxEntries);
}

export function readPersistedUiShellState<TResponse, TRunRequest>(
  storageKey: string
): PersistedUiShellState<TResponse, TRunRequest> | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedUiShellState<TResponse, TRunRequest>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const activeTab = parsed.activeTab;
    if (activeTab !== "query" && activeTab !== "mapping" && activeTab !== "timeline" && activeTab !== "diagnostics") {
      return null;
    }

    return {
      activeTab,
      response: parsed.response ?? null,
      lastRunRequest: parsed.lastRunRequest ?? null
    };
  } catch {
    return null;
  }
}

export function persistUiShellState<TResponse, TRunRequest>(
  storageKey: string,
  state: PersistedUiShellState<TResponse, TRunRequest>
): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(state));
}
