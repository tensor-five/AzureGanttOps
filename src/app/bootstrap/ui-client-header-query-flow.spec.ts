// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  createInitialHeaderQueryFlowState,
  deleteSavedHeaderQueryFlow,
  loadSavedHeaderQueryFlow,
  resolveHydratedHeaderQuerySelection,
  saveCurrentHeaderQueryFlow
} from "./ui-client-header-query-flow.js";
import type { SavedQueryPreference } from "../../shared/user-preferences/user-preferences.client.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

function createSavedQuery(id: string, queryInput = id): SavedQueryPreference {
  return {
    id,
    name: `Query ${id}`,
    queryInput
  };
}

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
    const runQuery = vi.fn(async () => ({ success: true } as QueryIntakeResponse));

    const result = await loadSavedHeaderQueryFlow({
      queryId: "q-1",
      state: {
        savedHeaderQueries: [createSavedQuery("q-1", "https://dev.azure.com/org/project/_queries/query?qid=q-1")],
        headerQueryLoading: false
      },
      runQuery,
      persistPatch
    });

    expect(result).toEqual({ kind: "loaded", selectedHeaderQueryId: "q-1" });
    expect(runQuery).toHaveBeenCalledWith({ queryId: "https://dev.azure.com/org/project/_queries/query?qid=q-1" });
    expect(persistPatch).toHaveBeenCalledWith({ selectedHeaderQueryId: "q-1" });
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
    const runQuery = vi.fn(async () => ({ success: true } as QueryIntakeResponse));

    const result = await saveCurrentHeaderQueryFlow({
      rawInput: "123",
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
    expect(runQuery).toHaveBeenCalledWith({ queryId: "https://dev.azure.com/org/project/_queries/query?qid=123" });
    expect(persistPatch).toHaveBeenCalledTimes(1);
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
});
