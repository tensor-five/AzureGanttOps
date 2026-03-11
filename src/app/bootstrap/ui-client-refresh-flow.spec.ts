// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { resolvePersistedRefreshQueryInput, runRetryRefreshFlow, type RunRequest } from "./ui-client-refresh-flow.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

function makeResponse(overrides?: Partial<QueryIntakeResponse>): QueryIntakeResponse {
  return {
    statusCode: "OK",
    preflightStatus: "READY",
    uiState: "ready",
    activeQueryId: "query-1",
    errorCode: null,
    mappingValidation: {
      status: "valid",
      issues: []
    },
    timeline: null,
    savedQueries: [],
    ...overrides
  } as QueryIntakeResponse;
}

describe("ui-client-refresh-flow", () => {
  it("returns refreshed payload when last run request exists", async () => {
    const request: RunRequest = { queryInput: "abc" };
    const response = makeResponse();
    const submit = vi.fn(async () => response);
    const enrich = vi.fn(async (value: QueryIntakeResponse) => value);

    const result = await runRetryRefreshFlow({
      lastRunRequest: request,
      submit,
      enrichRuntimeStateColors: enrich,
      runQuery: vi.fn()
    });

    expect(submit).toHaveBeenCalledWith(request);
    expect(result.kind).toBe("refreshed");
  });

  it("returns blocker when no persisted query is available", async () => {
    localStorage.removeItem("azure-ganttops.query-input");

    const result = await runRetryRefreshFlow({
      lastRunRequest: null,
      submit: vi.fn(),
      enrichRuntimeStateColors: vi.fn(),
      runQuery: vi.fn()
    });

    expect(result).toEqual({
      kind: "blocked_no_query",
      blocker: {
        tab: "query",
        reason: "No query available to refresh.",
        nextAction: "Open controls, enter Query ID, then run query."
      }
    });
  });

  it("triggers runQuery when persisted query input exists", async () => {
    localStorage.setItem("azure-ganttops.query-input", "123");
    localStorage.setItem("azure-ganttops.organization", "org");
    localStorage.setItem("azure-ganttops.project", "project");
    const runQuery = vi.fn(async () => makeResponse());

    const result = await runRetryRefreshFlow({
      lastRunRequest: null,
      submit: vi.fn(),
      enrichRuntimeStateColors: vi.fn(),
      runQuery
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "query_triggered" });
  });

  it("resolves persisted query input from localStorage context", () => {
    localStorage.setItem("azure-ganttops.query-input", "123");
    localStorage.setItem("azure-ganttops.organization", "org");
    localStorage.setItem("azure-ganttops.project", "project");

    expect(resolvePersistedRefreshQueryInput()).toBe("https://dev.azure.com/org/project/_queries/query?qid=123");
  });
});
