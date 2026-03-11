// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSavedQueryLabel,
  inferSavedQueryId,
  persistUiShellState,
  readPersistedUiShellState,
  resolvePersistedRefreshQueryInput,
  toShortQueryName,
  upsertSavedQueries
} from "./ui-client-storage.js";

describe("ui-client-storage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("resolves persisted refresh query input from localStorage", () => {
    localStorage.setItem("query", "abc");
    localStorage.setItem("org", "org-1");
    localStorage.setItem("project", "proj-1");
    const resolver = vi.fn((queryInput: string, organization: string, project: string) =>
      `${organization}/${project}/${queryInput}`
    );

    const result = resolvePersistedRefreshQueryInput({
      queryInputKey: "query",
      orgKey: "org",
      projectKey: "project",
      resolveQueryRunInput: resolver
    });

    expect(result).toBe("org-1/proj-1/abc");
    expect(resolver).toHaveBeenCalledWith("abc", "org-1", "proj-1");
  });

  it("derives short labels and infers query ids", () => {
    expect(buildSavedQueryLabel()).toBe("Unbenannte Query");
    expect(toShortQueryName("Folder/Sub/Important Query", "id-1")).toBe("Important Query");
    expect(inferSavedQueryId("https://dev.azure.com/a/_queries/query/11111111-1111-4111-8111-111111111111/")).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("upserts queries and roundtrips persisted UI shell state", () => {
    const upserted = upsertSavedQueries(
      [{ id: "2", name: "Second" }],
      { id: "1", name: "First" },
      2
    );
    expect(upserted.map((entry) => entry.id)).toEqual(["1", "2"]);

    persistUiShellState("ui-key", {
      activeTab: "timeline",
      response: { ok: true },
      lastRunRequest: { queryInput: "abc" }
    });
    expect(readPersistedUiShellState("ui-key")).toEqual({
      activeTab: "timeline",
      response: { ok: true },
      lastRunRequest: { queryInput: "abc" }
    });
  });
});
