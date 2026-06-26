// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import { useInitialQueryOnboardingFlow } from "./use-initial-query-onboarding-flow.js";

const QUERY_ID = "37f6f880-0b7b-4350-9f97-7263b40d4e95";
const QUERY_URL = `https://dev.azure.com/org/project/_queries/query/${QUERY_ID}`;

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

describe("use-initial-query-onboarding-flow", () => {
  it("submits, saves and completes the initial query onboarding", async () => {
    const loadedResponse = createResponse();
    const runQuery = vi.fn(async () => loadedResponse);
    const saveLoadedHeaderQuery = vi.fn(async () => ({
      kind: "saved" as const,
      savedHeaderQueries: [],
      selectedHeaderQueryId: QUERY_ID
    }));
    const hydratePreferences = vi.fn(async () => ({}));

    const { result } = renderHook(() =>
      useInitialQueryOnboardingFlow({
        restoredResponse: null,
        runQuery,
        saveLoadedHeaderQuery,
        hydratePreferences
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("required");
    });

    act(() => {
      result.current.setQueryInput(QUERY_URL);
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(runQuery).toHaveBeenCalledWith({ queryId: QUERY_URL });
    expect(saveLoadedHeaderQuery).toHaveBeenCalledWith({
      rawInput: QUERY_URL,
      transportQueryInput: QUERY_URL,
      resolvedContext: {
        organization: "org",
        project: "project",
        queryId: QUERY_ID
      },
      loadedResponse
    });
    expect(result.current.status).toBe("completed");
    expect(result.current.loading).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it("keeps loading reset and surfaces runtime errors", async () => {
    const runQuery = vi.fn(async () => {
      throw new Error("Azure CLI ist nicht angemeldet.");
    });
    const saveLoadedHeaderQuery = vi.fn();
    const hydratePreferences = vi.fn(async () => ({}));

    const { result } = renderHook(() =>
      useInitialQueryOnboardingFlow({
        restoredResponse: null,
        runQuery,
        saveLoadedHeaderQuery,
        hydratePreferences
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("required");
    });

    act(() => {
      result.current.setQueryInput(QUERY_URL);
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(saveLoadedHeaderQuery).not.toHaveBeenCalled();
    expect(result.current.status).toBe("required");
    expect(result.current.loading).toBe(false);
    expect(result.current.errorMessage).toBe("Azure CLI ist nicht angemeldet.");
  });

  it("rejects raw query IDs during initial onboarding", async () => {
    const runQuery = vi.fn(async () => createResponse());
    const saveLoadedHeaderQuery = vi.fn();
    const hydratePreferences = vi.fn(async () => ({}));

    const { result } = renderHook(() =>
      useInitialQueryOnboardingFlow({
        restoredResponse: null,
        runQuery,
        saveLoadedHeaderQuery,
        hydratePreferences
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("required");
    });

    act(() => {
      result.current.setQueryInput(QUERY_ID);
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(runQuery).not.toHaveBeenCalled();
    expect(saveLoadedHeaderQuery).not.toHaveBeenCalled();
    expect(result.current.status).toBe("required");
    expect(result.current.loading).toBe(false);
    expect(result.current.errorMessage).toBe("Füge eine vollständige Azure DevOps Query-URL ein.");
  });
});
