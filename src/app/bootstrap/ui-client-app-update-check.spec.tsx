// @vitest-environment jsdom

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type {
  QueryIntakeTransport,
  WriteCommandTransportResult
} from "../composition/ui-shell.composition.js";
import {
  createDefaultUiShellComposition,
  UiShellApp
} from "./ui-client.js";

const userPreferencesMock = vi.hoisted(() => {
  const queryId = "37f6f880-0b7b-4350-9f97-7263b40d4e95";
  const queryUrl = `https://dev.azure.com/org/project/_queries/query/${queryId}`;
  const preferences = {
    themeMode: "system" as const,
    selectedHeaderQueryId: queryId,
    savedQueries: [
      {
        id: queryId,
        name: "Delivery",
        queryInput: queryUrl,
        organization: "org",
        project: "project"
      }
    ]
  };

  return {
    preferences,
    getCachedUserPreferences: vi.fn(() => preferences),
    hydrateUserPreferences: vi.fn(async () => preferences),
    persistUserPreferencesPatch: vi.fn()
  };
});

const QUERY_ID = "37f6f880-0b7b-4350-9f97-7263b40d4e95";
const QUERY_URL = `https://dev.azure.com/org/project/_queries/query/${QUERY_ID}`;

vi.mock("../../shared/user-preferences/user-preferences.client.js", () => ({
  getCachedUserPreferences: userPreferencesMock.getCachedUserPreferences,
  hydrateUserPreferences: userPreferencesMock.hydrateUserPreferences,
  persistUserPreferencesPatch: userPreferencesMock.persistUserPreferencesPatch
}));

vi.mock("./use-ado-comm-log-polling.js", () => ({
  useAdoCommLogPolling: () => ({
    logs: [],
    loading: false,
    error: null
  })
}));

vi.mock("../../features/gantt-view/timeline-pane.js", async () => {
  const react = await import("react");
  return {
    TimelinePane: () => react.createElement("section", { "aria-label": "timeline-pane" })
  };
});

describe("UiShellApp app update checks", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.setItem("azure-ganttops.organization", "org");
    localStorage.setItem("azure-ganttops.project", "project");
    userPreferencesMock.getCachedUserPreferences.mockClear();
    userPreferencesMock.hydrateUserPreferences.mockClear();
    userPreferencesMock.persistUserPreferencesPatch.mockClear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("triggers an app update check after successful query run and retry refresh", async () => {
    const controller = createController();
    controller.submit
      .mockResolvedValueOnce(createQueryResponse({
        uiState: "ready_with_lkg_warning",
        guidance: "Latest refresh failed; showing last-known-good timeline.",
        strictFail: {
          active: true,
          message: "Latest refresh failed.",
          retryActionLabel: "Refresh",
          dismissible: true,
          dismissed: false,
          lastSuccessfulRefreshAt: "2026-06-27T09:59:00.000Z",
          lastSuccessfulSource: "full_reload"
        }
      }))
      .mockResolvedValueOnce(createQueryResponse());
    const composition = createDefaultUiShellComposition({
      controller
    });

    render(
      React.createElement(
        QueryClientProvider,
        { client: composition.queryClient },
        React.createElement(
          BrowserRouter,
          null,
          React.createElement(UiShellApp, {
            composition
          })
        )
      )
    );

    openControlsPanel();

    fireEvent.change(screen.getByLabelText("Query ID"), {
      target: { value: QUERY_ID }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query by ID" }));

    await waitFor(() => {
      expect(controller.submit).toHaveBeenCalledTimes(1);
      expect(controller.checkAppUpdate).toHaveBeenCalledTimes(1);
    });
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(controller.submit).toHaveBeenCalledTimes(2);
      expect(controller.checkAppUpdate).toHaveBeenCalledTimes(2);
    });
    expect(controller.submit).toHaveBeenNthCalledWith(1, {
      queryInput: QUERY_URL,
      mappingProfileId: undefined,
      mappingProfileUpsert: undefined
    });
    expect(controller.submit).toHaveBeenNthCalledWith(2, {
      queryInput: QUERY_URL,
      mappingProfileId: undefined,
      mappingProfileUpsert: undefined
    });
  });
});

function openControlsPanel(): void {
  const statusDetails = screen.getByLabelText("Status") as HTMLDetailsElement;
  statusDetails.open = true;
  fireEvent(statusDetails, new Event("toggle"));
}

type TestController = Omit<QueryIntakeTransport, "submit" | "checkAppUpdate"> & {
  submit: Mock<QueryIntakeTransport["submit"]>;
  checkAppUpdate: Mock<QueryIntakeTransport["checkAppUpdate"]>;
};

function createController(): TestController {
  return {
    submit: vi.fn<QueryIntakeTransport["submit"]>(),
    fetchAdoCommLogs: vi.fn(async () => ({
      entries: [],
      nextSeq: 0
    })),
    adoptWorkItemSchedule: vi.fn(async () => createWriteResult("WORK_ITEM_PATCH")),
    linkDependency: vi.fn(async () => createWriteResult("DEPENDENCY_LINK")),
    updateWorkItemDetails: vi.fn(async () => createWriteResult("WORK_ITEM_PATCH")),
    updateWorkItemState: vi.fn(async () => createWriteResult("WORK_ITEM_PATCH")),
    duplicateWorkItem: vi.fn(async () => createWriteResult("WORK_ITEM_DUPLICATE")),
    createChildWorkItem: vi.fn(async () => createWriteResult("WORK_ITEM_CHILD_CREATE")),
    reparentWorkItem: vi.fn(async () => createWriteResult("HIERARCHY_LINK")),
    fetchWorkItemStateOptions: vi.fn(async () => ({
      states: []
    })),
    fetchWorkItemTypes: vi.fn(async () => ({
      workItemTypes: []
    })),
    fetchQueryDetails: vi.fn(async ({ queryId }) => ({
      id: queryId,
      name: queryId,
      path: queryId
    })),
    authenticateAzureCli: vi.fn(async () => ({
      status: "OK" as const,
      message: "Azure CLI login is available in the app update check test."
    })),
    setAzureCliPath: vi.fn(async (path: string) => ({
      status: "OK" as const,
      path
    })),
    resetLocalConfigs: vi.fn(async () => ({
      status: "completed" as const,
      targets: []
    })),
    checkAppUpdate: vi.fn<QueryIntakeTransport["checkAppUpdate"]>(async () => ({
      status: "current" as const,
      currentVersion: "1.8.3",
      latestVersion: "1.8.3",
      checkedAt: "2026-06-27T10:00:00.000Z",
      source: "github" as const
    }))
  };
}

function createQueryResponse(overrides?: Partial<QueryIntakeResponse>): QueryIntakeResponse {
  return {
    success: true,
    guidance: null,
    statusCode: "OK",
    errorCode: null,
    preflightStatus: "READY",
    selectedQueryId: QUERY_ID,
    activeQueryId: QUERY_ID,
    lastRefreshAt: "2026-06-27T10:00:00.000Z",
    reloadSource: "full_reload",
    uiState: "ready",
    trustState: "ready",
    strictFail: {
      active: false,
      message: null,
      retryActionLabel: null,
      dismissible: true,
      dismissed: false,
      lastSuccessfulRefreshAt: null,
      lastSuccessfulSource: null
    },
    capabilities: {
      canRefresh: true,
      canSwitchQuery: true,
      canChangeDensity: true,
      canOpenDetails: true,
      readOnlyTimeline: true
    },
    density: "comfortable",
    savedQueries: [],
    workItemIds: [],
    relations: [],
    timeline: null,
    mappingValidation: {
      status: "valid",
      issues: []
    },
    activeMappingProfileId: null,
    detectedFieldRefs: [],
    view: "",
    ...overrides
  };
}

function createWriteResult(commandKind: WriteCommandTransportResult["commandKind"]): WriteCommandTransportResult {
  return {
    accepted: false,
    mode: "NO_OP",
    commandKind,
    operationCount: 0,
    reasonCode: "WRITE_DISABLED"
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

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
    }),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    get length() {
      return values.size;
    }
  });
}
