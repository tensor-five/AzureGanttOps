// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createInitialHeaderQueryFlowState,
  deleteSavedHeaderQueryFlow,
  editSavedHeaderQueryFlow,
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
        throw new Error("Azure CLI is not signed in.");
      }),
      persistPatch: vi.fn(),
      storage
    });

    expect(result).toEqual({
      kind: "error",
      message: "Azure CLI is not signed in."
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

  describe("editSavedHeaderQueryFlow", () => {
    const OTHER_QUERY_ID = "4a1b2c3d-1111-4222-8333-944455556666";
    const OTHER_QUERY_URL = `https://dev.azure.com/org/project/_queries/query/${OTHER_QUERY_ID}`;

    function createEntry(id: string, queryInput: string): SavedQueryPreference {
      return { id, name: `Query ${id}`, queryInput, organization: "org", project: "project" };
    }

    it("renames a saved query without running it and keeps its position", async () => {
      const persistPatch = vi.fn();
      const runQuery = vi.fn();

      const result = await editSavedHeaderQueryFlow({
        queryId: QUERY_ID,
        name: "  Sprint roadmap  ",
        rawInput: QUERY_URL,
        state: {
          savedHeaderQueries: [createEntry("q-0", "q-0"), createEntry(QUERY_ID, QUERY_URL)],
          selectedHeaderQueryId: QUERY_ID,
          headerQueryLoading: false
        },
        runQuery,
        persistPatch
      });

      expect(result).toMatchObject({ kind: "updated", selectedHeaderQueryId: QUERY_ID, reloaded: false });
      if (result.kind !== "updated") throw new Error("expected update");
      expect(result.savedHeaderQueries.map((entry) => entry.name)).toEqual(["Query q-0", "Sprint roadmap"]);
      expect(result.savedHeaderQueries[1]).toMatchObject({ id: QUERY_ID, queryInput: QUERY_URL });
      expect(runQuery).not.toHaveBeenCalled();
      expect(persistPatch).toHaveBeenCalledWith({ savedQueries: result.savedHeaderQueries });
    });

    it("reloads the active query when its query input changes", async () => {
      const persistPatch = vi.fn();
      const storage = { setItem: vi.fn() };
      const runQuery = vi.fn(async () =>
        createResponse({ selectedQueryId: OTHER_QUERY_ID, activeQueryId: OTHER_QUERY_ID })
      );

      const result = await editSavedHeaderQueryFlow({
        queryId: QUERY_ID,
        name: "Renamed",
        rawInput: OTHER_QUERY_URL,
        state: {
          savedHeaderQueries: [createEntry(QUERY_ID, QUERY_URL)],
          selectedHeaderQueryId: QUERY_ID,
          headerQueryLoading: false
        },
        runQuery,
        persistPatch,
        storage
      });

      expect(runQuery).toHaveBeenCalledWith({ queryId: OTHER_QUERY_URL });
      expect(result).toMatchObject({ kind: "updated", selectedHeaderQueryId: OTHER_QUERY_ID, reloaded: true });
      if (result.kind !== "updated") throw new Error("expected update");
      expect(result.savedHeaderQueries).toEqual([
        { id: OTHER_QUERY_ID, name: "Renamed", queryInput: OTHER_QUERY_URL, organization: "org", project: "project" }
      ]);
      expect(persistPatch).toHaveBeenCalledWith({
        savedQueries: result.savedHeaderQueries,
        selectedHeaderQueryId: OTHER_QUERY_ID
      });
      expect(storage.setItem).toHaveBeenCalled();
    });

    it("updates an inactive query without reloading the timeline", async () => {
      const persistPatch = vi.fn();
      const runQuery = vi.fn();

      const result = await editSavedHeaderQueryFlow({
        queryId: QUERY_ID,
        name: "Backlog",
        rawInput: OTHER_QUERY_ID,
        state: {
          savedHeaderQueries: [createEntry("active", "active"), createEntry(QUERY_ID, QUERY_URL)],
          selectedHeaderQueryId: "active",
          headerQueryLoading: false
        },
        runQuery,
        persistPatch
      });

      expect(runQuery).not.toHaveBeenCalled();
      expect(result).toMatchObject({ kind: "updated", selectedHeaderQueryId: "active", reloaded: false });
      if (result.kind !== "updated") throw new Error("expected update");
      expect(result.savedHeaderQueries[1]).toEqual({
        id: OTHER_QUERY_ID,
        name: "Backlog",
        queryInput: OTHER_QUERY_URL,
        organization: "org",
        project: "project"
      });
    });

    it("rejects an empty name", async () => {
      const persistPatch = vi.fn();
      const result = await editSavedHeaderQueryFlow({
        queryId: QUERY_ID,
        name: "   ",
        rawInput: QUERY_URL,
        state: { savedHeaderQueries: [createEntry(QUERY_ID, QUERY_URL)], selectedHeaderQueryId: "", headerQueryLoading: false },
        runQuery: vi.fn(),
        persistPatch
      });

      expect(result).toEqual({ kind: "error", message: "Enter a query name." });
      expect(persistPatch).not.toHaveBeenCalled();
    });

    it("rejects an invalid query input", async () => {
      const persistPatch = vi.fn();
      const result = await editSavedHeaderQueryFlow({
        queryId: QUERY_ID,
        name: "Name",
        rawInput: "not a query",
        state: { savedHeaderQueries: [createEntry(QUERY_ID, QUERY_URL)], selectedHeaderQueryId: "", headerQueryLoading: false },
        runQuery: vi.fn(),
        persistPatch
      });

      expect(result).toEqual({ kind: "error", message: "Invalid query. Provide a URL or a query ID with context." });
      expect(persistPatch).not.toHaveBeenCalled();
    });

    it("rejects a query input that points to another saved query", async () => {
      const persistPatch = vi.fn();
      const result = await editSavedHeaderQueryFlow({
        queryId: QUERY_ID,
        name: "Name",
        rawInput: OTHER_QUERY_URL,
        state: {
          savedHeaderQueries: [createEntry(QUERY_ID, QUERY_URL), createEntry(OTHER_QUERY_ID, OTHER_QUERY_URL)],
          selectedHeaderQueryId: "",
          headerQueryLoading: false
        },
        runQuery: vi.fn(),
        persistPatch
      });

      expect(result).toEqual({ kind: "error", message: "This query is already saved." });
      expect(persistPatch).not.toHaveBeenCalled();
    });

    it("keeps the saved query unchanged when reloading the active query fails", async () => {
      const persistPatch = vi.fn();
      const result = await editSavedHeaderQueryFlow({
        queryId: QUERY_ID,
        name: "Name",
        rawInput: OTHER_QUERY_URL,
        state: { savedHeaderQueries: [createEntry(QUERY_ID, QUERY_URL)], selectedHeaderQueryId: QUERY_ID, headerQueryLoading: false },
        runQuery: vi.fn(async () => {
          throw new Error("Query not found.");
        }),
        persistPatch
      });

      expect(result).toEqual({ kind: "error", message: "Query not found." });
      expect(persistPatch).not.toHaveBeenCalled();
    });

    it("reports a missing entry and ignores edits while loading", async () => {
      const base = { name: "Name", rawInput: QUERY_URL, runQuery: vi.fn(), persistPatch: vi.fn() };
      await expect(
        editSavedHeaderQueryFlow({
          ...base,
          queryId: "missing",
          state: { savedHeaderQueries: [], selectedHeaderQueryId: "", headerQueryLoading: false }
        })
      ).resolves.toEqual({ kind: "error", message: "The selected query could not be found." });
      await expect(
        editSavedHeaderQueryFlow({
          ...base,
          queryId: QUERY_ID,
          state: { savedHeaderQueries: [], selectedHeaderQueryId: "", headerQueryLoading: true }
        })
      ).resolves.toEqual({ kind: "ignored_loading" });
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
