import {
  type SavedQueryPreference,
  persistUserPreferencesPatch,
  type UserPreferences
} from "../../shared/user-preferences/user-preferences.client.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import {
  ORG_KEY,
  PROJECT_KEY,
  QUERY_INPUT_KEY,
  resolveRuntimeQueryInput,
  type RuntimeQueryInputResolution
} from "../../features/query-switching/runtime-query-input.js";
import {
  buildSavedHeaderQueryCandidate,
  filterHeaderQueries,
  findAzureSavedQueryName,
  resolveDeletedHeaderQueries
} from "./ui-client-header-query-service.js";
import {
  buildSavedQueryLabel,
  readPersistedQueryContext,
  upsertSavedQueries
} from "./ui-client-storage.js";

const INVALID_QUERY_MESSAGE = "Invalid query. Provide a URL or a query ID with context.";
const QUERY_LOAD_FAILED_MESSAGE = "Query could not be loaded.";
const QUERY_SAVE_FAILED_MESSAGE = "Query could not be saved because loading did not complete.";

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

  let resolvedInput: RuntimeQueryInputResolution;
  try {
    resolvedInput = resolveRuntimeQueryInput(selected.queryInput, {
      organization: selected.organization ?? "",
      project: selected.project ?? ""
    });
  } catch {
    return {
      kind: "error",
      message: QUERY_LOAD_FAILED_MESSAGE
    };
  }

  try {
    await params.runQuery({
      queryId: resolvedInput.transportQueryInput
    });
    (params.persistPatch ?? persistUserPreferencesPatch)({
      selectedHeaderQueryId: selected.id
    });
    persistCompatibilityQueryContext({
      ...resolvedInput,
      storage: params.storage
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

  let resolvedInput: RuntimeQueryInputResolution;
  try {
    resolvedInput = resolveRuntimeQueryInput(normalizedInput, persisted);
  } catch {
    return {
      kind: "error",
      message: INVALID_QUERY_MESSAGE
    };
  }

  let loadedResponse: QueryIntakeResponse;
  try {
    loadedResponse = await params.runQuery({
      queryId: resolvedInput.transportQueryInput
    });
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : QUERY_LOAD_FAILED_MESSAGE
    };
  }

  return saveLoadedHeaderQueryFlow({
    ...resolvedInput,
    state: params.state,
    loadedResponse,
    fallbackResponse: params.response,
    fetchQueryDetails: params.fetchQueryDetails,
    headerSavedQueryLimit: params.headerSavedQueryLimit,
    persistPatch: params.persistPatch
  });
}

export async function saveLoadedHeaderQueryFlow(params: RuntimeQueryInputResolution & {
  state: Pick<HeaderQueryFlowState, "savedHeaderQueries" | "headerQueryLoading">;
  loadedResponse: QueryIntakeResponse;
  fallbackResponse?: QueryIntakeResponse | null;
  fetchQueryDetails: (input: { queryId: string }) => Promise<{ name: string }>;
  headerSavedQueryLimit: number;
  persistPatch?: typeof persistUserPreferencesPatch;
  storage?: Pick<Storage, "setItem">;
}): Promise<HeaderQuerySaveResult> {
  if (params.state.headerQueryLoading) {
    return {
      kind: "ignored_loading"
    };
  }

  if (!isSaveableLoadedQueryResponse(params.loadedResponse)) {
    return {
      kind: "error",
      message: resolveLoadedQuerySaveError(params.loadedResponse)
    };
  }

  const queryId = params.loadedResponse.activeQueryId;
  let azureQueryName =
    findAzureSavedQueryName(params.loadedResponse, queryId) ??
    findAzureSavedQueryName(params.fallbackResponse ?? null, queryId);

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
    transportQueryInput: params.transportQueryInput,
    organization: params.resolvedContext.organization,
    project: params.resolvedContext.project,
    azureQueryName,
    fallbackLabel: buildSavedQueryLabel()
  });

  const nextSavedQueries = upsertSavedQueries(params.state.savedHeaderQueries, candidate, params.headerSavedQueryLimit);
  (params.persistPatch ?? persistUserPreferencesPatch)({
    savedQueries: nextSavedQueries,
    selectedHeaderQueryId: candidate.id
  });
  persistCompatibilityQueryContext(params);

  return {
    kind: "saved",
    savedHeaderQueries: nextSavedQueries,
    selectedHeaderQueryId: candidate.id
  };
}

function isSaveableLoadedQueryResponse(
  response: QueryIntakeResponse
): response is QueryIntakeResponse & { activeQueryId: string } {
  return response.preflightStatus === "READY" && response.statusCode === "OK" && Boolean(response.activeQueryId);
}

function resolveLoadedQuerySaveError(response: QueryIntakeResponse): string {
  if (response.guidance) {
    return response.guidance;
  }

  if (response.preflightStatus !== "READY") {
    return QUERY_LOAD_FAILED_MESSAGE;
  }

  return QUERY_SAVE_FAILED_MESSAGE;
}

function persistCompatibilityQueryContext(params: RuntimeQueryInputResolution & {
  storage?: Pick<Storage, "setItem">;
}): void {
  const storage = resolveWritableStorage(params.storage);
  if (!storage) {
    return;
  }

  persistStorageValue(storage, QUERY_INPUT_KEY, params.rawInput);
  persistStorageValue(storage, ORG_KEY, params.resolvedContext.organization);
  persistStorageValue(storage, PROJECT_KEY, params.resolvedContext.project);
}

function resolveWritableStorage(storage?: Pick<Storage, "setItem">): Pick<Storage, "setItem"> | undefined {
  if (storage && typeof storage.setItem === "function") {
    return storage;
  }

  if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
    return localStorage;
  }

  return undefined;
}

function persistStorageValue(storage: Pick<Storage, "setItem">, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // localStorage compatibility writes must never block the lowdb-backed flow.
  }
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
    selectedHeaderQueryId: next.selectedHeaderQueryId
  });

  return {
    savedHeaderQueries: next.queries,
    selectedHeaderQueryId: next.selectedHeaderQueryId
  };
}
