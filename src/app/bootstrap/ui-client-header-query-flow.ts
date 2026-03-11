import {
  type SavedQueryPreference,
  persistUserPreferencesPatch,
  type UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import { ORG_KEY, PROJECT_KEY, QUERY_INPUT_KEY, resolveQueryRunInput } from "../../features/query-switching/query-selector.js";
import {
  buildSavedHeaderQueryCandidate,
  filterHeaderQueries,
  findAzureSavedQueryName,
  resolveDeletedHeaderQueries
} from "./ui-client-header-query-service.js";
import {
  buildSavedQueryLabel,
  inferSavedQueryId,
  readPersistedQueryContext,
  upsertSavedQueries
} from "./ui-client-storage.js";

const INVALID_QUERY_MESSAGE = "Invalid query. Provide a URL or a query ID with context.";
const QUERY_LOAD_FAILED_MESSAGE = "Query could not be loaded.";

export type HeaderQueryFlowState = {
  savedHeaderQueries: SavedQueryPreference[];
  selectedHeaderQueryId: string;
  newHeaderQueryMode: boolean;
  newHeaderQueryInput: string;
  headerQuerySearch: string;
  headerQueryLoading: boolean;
  headerQueryMessage: string | null;
};

export type HeaderQueryLoadResult =
  | {
      kind: "loaded";
      selectedHeaderQueryId: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "ignored_loading";
    };

export type HeaderQuerySaveResult =
  | {
      kind: "saved";
      savedHeaderQueries: SavedQueryPreference[];
      selectedHeaderQueryId: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "ignored_loading";
    };

export type HeaderQueryDeleteResult = {
  savedHeaderQueries: SavedQueryPreference[];
  selectedHeaderQueryId: string;
};

export function createInitialHeaderQueryFlowState(preferences: UserPreferences): HeaderQueryFlowState {
  return {
    savedHeaderQueries: preferences.savedQueries ?? [],
    selectedHeaderQueryId: preferences.selectedHeaderQueryId ?? "",
    newHeaderQueryMode: false,
    newHeaderQueryInput: "",
    headerQuerySearch: "",
    headerQueryLoading: false,
    headerQueryMessage: null
  };
}

export function resolveHydratedHeaderQuerySelection(preferences: UserPreferences): {
  savedHeaderQueries: SavedQueryPreference[];
  selectedHeaderQueryId: string;
} {
  const hydratedSavedQueries = preferences.savedQueries ?? [];
  const preferredSelectedQueryId = preferences.selectedHeaderQueryId ?? "";
  const selectedExistsInSavedQueries = hydratedSavedQueries.some((entry) => entry.id === preferredSelectedQueryId);

  return {
    savedHeaderQueries: hydratedSavedQueries,
    selectedHeaderQueryId: selectedExistsInSavedQueries ? preferredSelectedQueryId : ""
  };
}

export function resolveFilteredHeaderQueries(
  savedHeaderQueries: SavedQueryPreference[],
  headerQuerySearch: string
): SavedQueryPreference[] {
  return filterHeaderQueries(savedHeaderQueries, headerQuerySearch);
}

export async function loadSavedHeaderQueryFlow(params: {
  queryId: string;
  state: Pick<HeaderQueryFlowState, "savedHeaderQueries" | "headerQueryLoading">;
  runQuery: (request: { queryId: string }) => Promise<QueryIntakeResponse>;
  persistPatch?: typeof persistUserPreferencesPatch;
  storage?: Pick<Storage, "setItem">;
}): Promise<HeaderQueryLoadResult> {
  if (params.state.headerQueryLoading) {
    return {
      kind: "ignored_loading"
    };
  }

  const selected = filterHeaderQueries(params.state.savedHeaderQueries, "").find((entry) => entry.id === params.queryId);
  if (!selected) {
    return {
      kind: "error",
      message: "The selected query could not be found."
    };
  }

  const storage = params.storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  if (storage) {
    storage.setItem(QUERY_INPUT_KEY, selected.queryInput);
    if (selected.organization) {
      storage.setItem(ORG_KEY, selected.organization);
    }
    if (selected.project) {
      storage.setItem(PROJECT_KEY, selected.project);
    }
  }

  try {
    await params.runQuery({
      queryId: selected.queryInput
    });
    (params.persistPatch ?? persistUserPreferencesPatch)({
      selectedHeaderQueryId: selected.id
    });

    return {
      kind: "loaded",
      selectedHeaderQueryId: selected.id
    };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : QUERY_LOAD_FAILED_MESSAGE
    };
  }
}

export async function saveCurrentHeaderQueryFlow(params: {
  rawInput: string;
  state: Pick<HeaderQueryFlowState, "savedHeaderQueries" | "headerQueryLoading">;
  response: QueryIntakeResponse | null;
  runQuery: (request: { queryId: string }) => Promise<QueryIntakeResponse>;
  fetchQueryDetails: (input: { queryId: string }) => Promise<{ name: string }>;
  headerSavedQueryLimit: number;
  persistPatch?: typeof persistUserPreferencesPatch;
}): Promise<HeaderQuerySaveResult> {
  if (params.state.headerQueryLoading) {
    return {
      kind: "ignored_loading"
    };
  }

  const normalizedInput = params.rawInput.trim();
  if (!normalizedInput) {
    return {
      kind: "error",
      message: INVALID_QUERY_MESSAGE
    };
  }

  const persisted = readPersistedQueryContext({
    queryInputKey: QUERY_INPUT_KEY,
    orgKey: ORG_KEY,
    projectKey: PROJECT_KEY
  });
  const transportQueryInput = resolveQueryRunInput(normalizedInput, persisted.organization, persisted.project);
  if (!transportQueryInput) {
    return {
      kind: "error",
      message: INVALID_QUERY_MESSAGE
    };
  }

  const queryId = inferSavedQueryId(transportQueryInput);
  try {
    await params.runQuery({
      queryId: transportQueryInput
    });
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : QUERY_LOAD_FAILED_MESSAGE
    };
  }

  let azureQueryName = findAzureSavedQueryName(params.response, queryId);
  try {
    const queryDetails = await params.fetchQueryDetails({ queryId });
    const normalizedName = queryDetails.name.trim();
    if (normalizedName.length > 0) {
      azureQueryName = normalizedName;
    }
  } catch {
    // Keep fallback name when query details request fails.
  }

  const candidate: SavedQueryPreference = buildSavedHeaderQueryCandidate({
    queryId,
    transportQueryInput,
    organization: persisted.organization,
    project: persisted.project,
    azureQueryName,
    fallbackLabel: buildSavedQueryLabel()
  });

  const nextSavedQueries = upsertSavedQueries(params.state.savedHeaderQueries, candidate, params.headerSavedQueryLimit);
  (params.persistPatch ?? persistUserPreferencesPatch)({
    savedQueries: nextSavedQueries,
    selectedHeaderQueryId: candidate.id
  });

  return {
    kind: "saved",
    savedHeaderQueries: nextSavedQueries,
    selectedHeaderQueryId: candidate.id
  };
}

export function deleteSavedHeaderQueryFlow(params: {
  queryId: string;
  state: Pick<HeaderQueryFlowState, "savedHeaderQueries" | "selectedHeaderQueryId">;
  persistPatch?: typeof persistUserPreferencesPatch;
}): HeaderQueryDeleteResult {
  const next = resolveDeletedHeaderQueries({
    queries: params.state.savedHeaderQueries,
    selectedHeaderQueryId: params.state.selectedHeaderQueryId,
    deletedQueryId: params.queryId
  });

  (params.persistPatch ?? persistUserPreferencesPatch)({
    savedQueries: next.queries,
    selectedHeaderQueryId: next.selectedHeaderQueryId || undefined
  });

  return {
    savedHeaderQueries: next.queries,
    selectedHeaderQueryId: next.selectedHeaderQueryId
  };
}
