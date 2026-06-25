// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createInitialHeaderQueryFlowState,
  deleteSavedHeaderQueryFlow,
  loadSavedHeaderQueryFlow,
  resolveHydratedHeaderQuerySelection,
  saveCurrentHeaderQueryFlow,
  saveLoadedHeaderQueryFlow
} from "./ui-client-header-query-flow.js";
import type { SavedQueryPreference } from "../../shared/user-preferences/user-preferences.client.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

const QUERY_ID = "37f6f880-0b7b-4350-9f97-7263b40d4e95";
const QUERY_URL = `https://dev.azure.com/org/project/_queries/query/${QUERY_ID}`;

function createSavedQuery(id: string, queryInput = id): SavedQueryPreference {
  return {
    id,
    name: `Query ${id}`,
    queryInput
  };
}

function createResponse(overrides?: Partial<QueryIntakeResponse>): QueryIntakeResponse {
  return {
    success: true,
    guidance: null,
    statusCode: "OK",
    errorCode: null,
    preflightStatus: "READY",
    selectedQueryId: QUERY_ID,
    activeQueryId: QUERY_ID,
    savedQueries: [],
    mappingValidation: {
      status: "valid",
      issues: []
    },
    ...overrides
  } as QueryIntakeResponse;
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ui-client-header-query-flow", () => {
  it("creates initial state from preferences", () => {
    const state = createInitialHeaderQueryFlowState({
      savedQueries: [createSavedQuery("q-1")],
      selectedHeaderQueryId: "q-1"
    });

    expect(state.savedHeaderQueries).toHaveLength(1);
    expect(state.selectedHeaderQueryId).toBe("q-1");
    expect(state.headerQueryLoading).toBe(false);
  });

  it("hydrates selected id only when the id exists in saved queries", () => {
    const selection = resolveHydratedHeaderQuerySelection({
      savedQueries: [createSavedQuery("q-1")],
      selectedHeaderQueryId: "missing"
    });

    expect(selection.selectedHeaderQueryId).toBe("");
  });

  it("loads a saved header query and persists selected id", async () => {
    const persistPatch = vi.fn();
    const runQuery = vi.fn(async () => createResponse());
    const order: string[] = [];
    const storage = {
      setItem: vi.fn((key: string) => {
        order.push(`storage:${key}`);
      })
    };

    const result = await loadSavedHeaderQueryFlow({
      queryId: QUERY_ID,
      state: {
        savedHeaderQueries: [
          {
            ...createSavedQuery(QUERY_ID, QUERY_URL),
            organization: "org",
            project: "project"
          }
        ],
        headerQueryLoading: false
      },
      runQuery,
      persistPatch: vi.fn((patch) => {
        order.push(`preferences:${patch.selectedHeaderQueryId ?? ""}`);
        persistPatch(patch);
      }),
      storage
    });

    expect(result).toEqual({ kind: "loaded", selectedHeaderQueryId: QUERY_ID });
    expect(runQuery).toHaveBeenCalledWith({ queryId: QUERY_URL });
    expect(persistPatch).toHaveBeenCalledWith({ selectedHeaderQueryId: QUERY_ID });
    expect(order).toEqual([
      `preferences:${QUERY_ID}`,
      "storage:azure-ganttops.query-input",
      "storage:azure-ganttops.organization",
      "storage:azure-ganttops.project"
    ]);
  });

  it("does not write the localStorage compatibility copy when loading a saved query fails", async () => {
    const storage = {
      setItem: vi.fn()
    };

    const result = await loadSavedHeaderQueryFlow({
      queryId: QUERY_ID,
      state: {
        savedHeaderQueries: [
          {
            ...createSavedQuery(QUERY_ID, QUERY_URL),
            organization: "org",
            project: "project"
          }
        ],
        headerQueryLoading: false
      },
      runQuery: vi.fn(async () => {
        throw new Error("Azure CLI ist nicht angemeldet.");
      }),
      persistPatch: vi.fn(),
      storage
    });

    expect(result).toEqual({
      kind: "error",
      message: "Azure CLI ist nicht angemeldet."
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("keeps loading a saved query successful when compatibility storage throws", async () => {
    const persistPatch = vi.fn();

    const result = await loadSavedHeaderQueryFlow({
      queryId: QUERY_ID,
      state: {
        savedHeaderQueries: [
          {
            ...createSavedQuery(QUERY_ID, QUERY_URL),
            organization: "org",
            project: "project"
          }
        ],
        headerQueryLoading: false
      },
      runQuery: vi.fn(async () => createResponse()),
      persistPatch,
      storage: {
        setItem: vi.fn(() => {
          throw new Error("Quota exceeded");
        })
      }
    });

    expect(result).toEqual({ kind: "loaded", selectedHeaderQueryId: QUERY_ID });
    expect(persistPatch).toHaveBeenCalledWith({ selectedHeaderQueryId: QUERY_ID });
  });

  it("returns error when saving invalid query input", async () => {
    const result = await saveCurrentHeaderQueryFlow({
      rawInput: "  ",
      state: {
        savedHeaderQueries: [],
        headerQueryLoading: false
      },
      response: null,
      runQuery: vi.fn(),
      fetchQueryDetails: vi.fn(),
      headerSavedQueryLimit: 25
    });

    expect(result).toEqual({
      kind: "error",
      message: "Invalid query. Provide a URL or a query ID with context."
    });
  });

  it("saves current header query and persists updated preferences", async () => {
    localStorage.setItem("azure-ganttops.organization", "org");
    localStorage.setItem("azure-ganttops.project", "project");

    const persistPatch = vi.fn();
    const runQuery = vi.fn(async () => createResponse());

    const result = await saveCurrentHeaderQueryFlow({
      rawInput: QUERY_ID,
      state: {
        savedHeaderQueries: [],
        headerQueryLoading: false
      },
      response: null,
      runQuery,
      fetchQueryDetails: vi.fn(async () => ({ name: "Important Query" })),
      headerSavedQueryLimit: 25,
      persistPatch
    });

    expect(result.kind).toBe("saved");
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith({ queryId: QUERY_URL });
    expect(persistPatch).toHaveBeenCalledTimes(1);
  });

  it("saves an already loaded mapping-invalid query without checking response.success", async () => {
    const persistPatch = vi.fn();
    const loadedResponse = createResponse({
      success: false,
      mappingValidation: {
        status: "invalid",
        issues: []
      },
      savedQueries: [
        {
          id: QUERY_ID,
          name: "Important Query",
          path: "Shared Queries/Important Query"
        }
      ]
    });

    const result = await saveLoadedHeaderQueryFlow({
      rawInput: QUERY_ID,
      transportQueryInput: QUERY_URL,
      resolvedContext: {
        organization: "org",
        project: "project",
        queryId: QUERY_ID
      },
      state: {
        savedHeaderQueries: [],
        headerQueryLoading: false
      },
      loadedResponse,
      fetchQueryDetails: vi.fn(async () => ({ name: "Important Query" })),
      headerSavedQueryLimit: 25,
      persistPatch
    });

    expect(result).toMatchObject({
      kind: "saved",
      selectedHeaderQueryId: QUERY_ID
    });
    expect(persistPatch).toHaveBeenCalledWith({
      savedQueries: [
        {
          id: QUERY_ID,
          name: "Important Query",
          queryInput: QUERY_URL,
          organization: "org",
          project: "project"
        }
      ],
      selectedHeaderQueryId: QUERY_ID
    });
  });

  it("patches preferences before writing the localStorage compatibility copy", async () => {
    const order: string[] = [];
    const persistPatch = vi.fn(() => {
      order.push("preferences");
    });
    const storage = {
      setItem: vi.fn((key: string) => {
        order.push(`storage:${key}`);
      })
    };

    await saveLoadedHeaderQueryFlow({
      rawInput: QUERY_ID,
      transportQueryInput: QUERY_URL,
      resolvedContext: {
        organization: "org",
        project: "project",
        queryId: QUERY_ID
      },
      state: {
        savedHeaderQueries: [],
        headerQueryLoading: false
      },
      loadedResponse: createResponse(),
      fetchQueryDetails: vi.fn(async () => ({ name: "Important Query" })),
      headerSavedQueryLimit: 25,
      persistPatch,
      storage
    });

    expect(order[0]).toBe("preferences");
    expect(order.slice(1)).toEqual([
      "storage:azure-ganttops.query-input",
      "storage:azure-ganttops.organization",
      "storage:azure-ganttops.project"
    ]);
  });

  it("keeps saving successful when compatibility storage throws", async () => {
    const persistPatch = vi.fn();

    const result = await saveLoadedHeaderQueryFlow({
      rawInput: QUERY_ID,
      transportQueryInput: QUERY_URL,
      resolvedContext: {
        organization: "org",
        project: "project",
        queryId: QUERY_ID
      },
      state: {
        savedHeaderQueries: [],
        headerQueryLoading: false
      },
      loadedResponse: createResponse(),
      fetchQueryDetails: vi.fn(async () => ({ name: "Important Query" })),
      headerSavedQueryLimit: 25,
      persistPatch,
      storage: {
        setItem: vi.fn(() => {
          throw new Error("Quota exceeded");
        })
      }
    });

    expect(result.kind).toBe("saved");
    expect(persistPatch).toHaveBeenCalledTimes(1);
  });

  it("does not save a loaded response without READY OK and active query id", async () => {
    const persistPatch = vi.fn();

    const result = await saveLoadedHeaderQueryFlow({
      rawInput: QUERY_ID,
      transportQueryInput: QUERY_URL,
      resolvedContext: {
        organization: "org",
        project: "project",
        queryId: QUERY_ID
      },
      state: {
        savedHeaderQueries: [],
        headerQueryLoading: false
      },
      loadedResponse: createResponse({
        activeQueryId: null
      }),
      fetchQueryDetails: vi.fn(),
      headerSavedQueryLimit: 25,
      persistPatch
    });

    expect(result).toEqual({
      kind: "error",
      message: "Query could not be saved because loading did not complete."
    });
    expect(persistPatch).not.toHaveBeenCalled();
  });

  it("deletes saved header query and persists query collection", () => {
    const persistPatch = vi.fn();

    const result = deleteSavedHeaderQueryFlow({
      queryId: "q-1",
      state: {
        savedHeaderQueries: [createSavedQuery("q-1"), createSavedQuery("q-2")],
        selectedHeaderQueryId: "q-1"
      },
      persistPatch
    });

    expect(result.savedHeaderQueries.map((entry) => entry.id)).toEqual(["q-2"]);
    expect(result.selectedHeaderQueryId).toBe("q-2");
    expect(persistPatch).toHaveBeenCalledWith({
      savedQueries: result.savedHeaderQueries,
      selectedHeaderQueryId: "q-2"
    });
  });

  it("persists an explicit empty selected query when deleting the last saved query", () => {
    const persistPatch = vi.fn();

    const result = deleteSavedHeaderQueryFlow({
      queryId: "q-1",
      state: {
        savedHeaderQueries: [createSavedQuery("q-1")],
        selectedHeaderQueryId: "q-1"
      },
      persistPatch
    });

    expect(result.savedHeaderQueries).toEqual([]);
    expect(result.selectedHeaderQueryId).toBe("");
    expect(persistPatch).toHaveBeenCalledWith({
      savedQueries: [],
      selectedHeaderQueryId: ""
    });
  });
});

function installMemoryStorage(): void {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    })
  });
}
