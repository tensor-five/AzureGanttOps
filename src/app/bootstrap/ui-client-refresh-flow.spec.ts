// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  buildSessionExpiredRefreshBlocker,
  resolvePersistedRefreshQueryInput,
  runRetryRefreshFlow,
  type RunRequest
} from "./ui-client-refresh-flow.js";
import {
  AZURE_SESSION_EXPIRED_NEXT_ACTION,
  AZURE_SESSION_EXPIRED_REASON
} from "../../shared/azure-devops/azure-session-recovery.js";
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

  it("routes refreshed session-expired payload back to query recovery", async () => {
    const request: RunRequest = { queryInput: "abc" };
    const response = makeResponse({
      statusCode: "SESSION_EXPIRED",
      preflightStatus: "SESSION_EXPIRED",
      uiState: "auth_failure",
      success: false,
      capabilities: {
        canRefresh: false,
        canSwitchQuery: false,
        canChangeDensity: true,
        canOpenDetails: true,
        readOnlyTimeline: true
      }
    });

    const result = await runRetryRefreshFlow({
      lastRunRequest: request,
      submit: vi.fn(async () => response),
      enrichRuntimeStateColors: vi.fn(async (value: QueryIntakeResponse) => value),
      runQuery: vi.fn()
    });

    expect(result).toMatchObject({
      kind: "refreshed",
      openMappingFix: false,
      activeTab: "query"
    });
    expect(buildSessionExpiredRefreshBlocker()).toEqual({
      tab: "query",
      reason: AZURE_SESSION_EXPIRED_REASON,
      nextAction: AZURE_SESSION_EXPIRED_NEXT_ACTION
    });
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
        nextAction: "Open OK menu, enter Query ID, then run query."
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
