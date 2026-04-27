import { describe, expect, it } from "vitest";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { SavedQueryPreference } from "../../shared/user-preferences/user-preferences.client.js";

import { findAzureSavedQueryName, resolveActiveQueryName } from "./ui-client-header-query-service.js";

function buildResponseWithSavedQueries(
  savedQueries: { id: string; name: string; path: string }[]
): QueryIntakeResponse {
  return {
    activeQueryId: savedQueries[0]?.id ?? "",
    selectedQueryId: savedQueries[0]?.id ?? "",
    statusCode: "OK",
    capabilities: {
      canSwitchQuery: true,
      canChangeDensity: true,
      canOpenDetails: true,
      readOnlyTimeline: false
    },
    density: "comfortable",
    savedQueries,
    workItemIds: [],
    relations: [],
    workItems: [],
    timeline: null,
    diagnostics: null,
    freshness: { lastRefreshAt: null, reloadSource: "manual", activeQueryId: null }
  } as unknown as QueryIntakeResponse;
}

function buildHeaderQuery(id: string, name: string): SavedQueryPreference {
  return { id, name, queryInput: id };
}

describe("findAzureSavedQueryName", () => {
  it("returns null when response is missing", () => {
    expect(findAzureSavedQueryName(null, "anything")).toBeNull();
  });

  it("matches case-insensitively and trims whitespace", () => {
    const response = buildResponseWithSavedQueries([
      { id: "ABC-123", name: "Delivery Plan", path: "Shared/Plan" }
    ]);

    expect(findAzureSavedQueryName(response, "  abc-123  ")).toBe("Delivery Plan");
  });

  it("returns null when name is empty", () => {
    const response = buildResponseWithSavedQueries([{ id: "abc", name: "   ", path: "p" }]);

    expect(findAzureSavedQueryName(response, "abc")).toBeNull();
  });
});

describe("resolveActiveQueryName", () => {
  it("returns null without an active query id", () => {
    expect(resolveActiveQueryName(null, null, [])).toBeNull();
  });

  it("prefers the Azure-Response name over the local header preference", () => {
    const response = buildResponseWithSavedQueries([
      { id: "abc", name: "Azure Name", path: "Shared/Plan" }
    ]);
    const headerQueries = [buildHeaderQuery("abc", "Local Name")];

    expect(resolveActiveQueryName("abc", response, headerQueries)).toBe("Azure Name");
  });

  it("falls back to the local header preference when Azure list lacks the query", () => {
    const headerQueries = [buildHeaderQuery("abc", "Local Name")];

    expect(resolveActiveQueryName("abc", null, headerQueries)).toBe("Local Name");
  });

  it("ignores fallback names that are identical to the query id", () => {
    const headerQueries = [buildHeaderQuery("abc", "abc")];

    expect(resolveActiveQueryName("abc", null, headerQueries)).toBeNull();
  });

  it("returns null when no source provides a usable name", () => {
    expect(resolveActiveQueryName("abc", null, [])).toBeNull();
  });
});
