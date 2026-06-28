// @vitest-environment jsdom

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const appUpdateCheckMock = vi.hoisted(() => {
  const trigger = vi.fn();
  const updateNotice = {
    currentVersion: "1.8.3",
    latestVersion: "1.9.0",
    checkedAt: "2026-06-27T10:00:00.000Z",
    source: "github" as const
  };

  return {
    trigger,
    useAppUpdateCheck: vi.fn(() => ({
      updateNotice,
      trigger
    }))
  };
});

vi.mock("../../shared/user-preferences/user-preferences.client.js", () => ({
  getCachedUserPreferences: userPreferencesMock.getCachedUserPreferences,
  hydrateUserPreferences: userPreferencesMock.hydrateUserPreferences,
  persistUserPreferencesPatch: userPreferencesMock.persistUserPreferencesPatch
}));

vi.mock("./use-app-update-check.js", () => ({
  useAppUpdateCheck: appUpdateCheckMock.useAppUpdateCheck
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

vi.mock("./app-changelog-dialog.js", async () => {
  const react = await import("react");
  return {
    AppChangelogDialog: (props: { open: boolean; updateNotice?: unknown; onClose: () => void }) =>
      props.open
        ? react.createElement(
            "div",
            {
              role: "dialog",
              "aria-label": props.updateNotice ? "Update-Hinweis" : "Changelog"
            },
            react.createElement(
              "button",
              {
                type: "button",
                onClick: props.onClose
              },
              "Schließen"
            )
          )
        : null
  };
});

vi.mock("./app-keyboard-shortcuts-dialog.js", async () => {
  const react = await import("react");
  return {
    AppKeyboardShortcutsDialog: (props: { open: boolean; onClose: () => void }) =>
      props.open
        ? react.createElement(
            "div",
            { role: "dialog", "aria-label": "Tastenkombinationen" },
            react.createElement(
              "button",
              {
                type: "button",
                onClick: props.onClose
              },
              "Schließen"
            )
          )
        : null
  };
});

import type {
  QueryIntakeTransport,
  WriteCommandTransportResult
} from "../composition/ui-shell.composition.js";
import {
  createDefaultUiShellComposition,
  UiShellApp
} from "./ui-client.js";

describe("UiShellApp header dialogs", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.setItem("azure-ganttops.organization", "org");
    localStorage.setItem("azure-ganttops.project", "project");
    userPreferencesMock.getCachedUserPreferences.mockClear();
    userPreferencesMock.hydrateUserPreferences.mockClear();
    userPreferencesMock.persistUserPreferencesPatch.mockClear();
    appUpdateCheckMock.trigger.mockClear();
    appUpdateCheckMock.useAppUpdateCheck.mockClear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("keeps changelog, update notice and keyboard shortcuts dialogs mutually exclusive", async () => {
    renderUiShell();

    fireEvent.click(screen.getByRole("button", { name: /Changelog zu Version .* öffnen/ }));

    expect(await screen.findByRole("dialog", { name: "Changelog" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Update-Hinweis" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Tastenkombinationen" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tastenkombinationen öffnen" }));

    expect(await screen.findByRole("dialog", { name: "Tastenkombinationen" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Changelog" })).toBeNull();
      expect(screen.queryByRole("dialog", { name: "Update-Hinweis" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Neue Version verfügbar. Changelog mit Update-Hinweis öffnen" }));

    expect(await screen.findByRole("dialog", { name: "Update-Hinweis" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Changelog" })).toBeNull();
      expect(screen.queryByRole("dialog", { name: "Tastenkombinationen" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /Changelog zu Version .* öffnen/ }));

    expect(await screen.findByRole("dialog", { name: "Changelog" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Update-Hinweis" })).toBeNull();
      expect(screen.queryByRole("dialog", { name: "Tastenkombinationen" })).toBeNull();
    });
  });
});

function renderUiShell(): void {
  const composition = createDefaultUiShellComposition({
    controller: createController()
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
}

function createController(): QueryIntakeTransport {
  return {
    submit: vi.fn(async () => {
      throw new Error("submit should not be called by the header dialog test");
    }),
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
      message: "Azure CLI login is available in the header dialog test."
    })),
    setAzureCliPath: vi.fn(async (path: string) => ({
      status: "OK" as const,
      path
    })),
    resetLocalConfigs: vi.fn(async () => ({
      status: "completed" as const,
      targets: []
    })),
    checkAppUpdate: vi.fn(async () => ({
      status: "current" as const,
      currentVersion: "1.8.3",
      latestVersion: "1.8.3",
      checkedAt: "2026-06-27T10:00:00.000Z",
      source: "github" as const
    }))
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
