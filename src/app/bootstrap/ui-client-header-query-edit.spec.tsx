// @vitest-environment jsdom

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
              "aria-label": props.updateNotice ? "Update notice" : "Changelog"
            },
            react.createElement(
              "button",
              {
                type: "button",
                onClick: props.onClose
              },
              "Close"
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
            { role: "dialog", "aria-label": "Keyboard shortcuts" },
            react.createElement(
              "button",
              {
                type: "button",
                onClick: props.onClose
              },
              "Close"
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

const EDITED_QUERY_ID = "4a1b2c3d-1111-4222-8333-944455556666";
const EDITED_QUERY_URL = `https://dev.azure.com/org/project/_queries/query/${EDITED_QUERY_ID}`;

describe("UiShellApp header query editing", () => {
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

  it("renames a saved query inline without reloading it", async () => {
    const controller = renderUiShell();

    fireEvent.click(screen.getByRole("button", { name: "Edit query Delivery" }));
    const form = await screen.findByRole("form", { name: "Edit saved query" });
    const nameInput = within(form).getByRole("textbox", { name: "Query name" }) as HTMLInputElement;
    expect(nameInput.value).toBe("Delivery");
    expect((within(form).getByRole("textbox", { name: "Query URL or ID" }) as HTMLInputElement).value).toBe(
      userPreferencesMock.preferences.savedQueries[0].queryInput
    );

    fireEvent.change(nameInput, { target: { value: "Sprint roadmap" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "Edit query Sprint roadmap" })).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Edit saved query" })).toBeNull();
    expect(userPreferencesMock.persistUserPreferencesPatch).toHaveBeenCalledWith({
      savedQueries: [
        expect.objectContaining({
          id: userPreferencesMock.preferences.savedQueries[0].id,
          name: "Sprint roadmap"
        })
      ]
    });
    expect(controller.submit).not.toHaveBeenCalled();
  });

  it("cancels editing with Escape and keeps the saved query", async () => {
    renderUiShell();

    fireEvent.click(screen.getByRole("button", { name: "Edit query Delivery" }));
    const form = await screen.findByRole("form", { name: "Edit saved query" });
    const nameInput = within(form).getByRole("textbox", { name: "Query name" });
    fireEvent.change(nameInput, { target: { value: "Discarded" } });
    fireEvent.keyDown(nameInput, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("form", { name: "Edit saved query" })).toBeNull();
    });
    expect(screen.getByRole("button", { name: "Edit query Delivery" })).toBeTruthy();
    expect(userPreferencesMock.persistUserPreferencesPatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ savedQueries: expect.anything() })
    );
  });

  it("shows a validation error inside the form for an empty name", async () => {
    renderUiShell();

    fireEvent.click(screen.getByRole("button", { name: "Edit query Delivery" }));
    const form = await screen.findByRole("form", { name: "Edit saved query" });
    fireEvent.change(within(form).getByRole("textbox", { name: "Query name" }), { target: { value: " " } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect((await within(form).findByRole("alert")).textContent).toBe("Enter a query name.");
    expect(userPreferencesMock.persistUserPreferencesPatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ savedQueries: expect.anything() })
    );
  });

  it("reloads the active query with the edited input and keeps the entry when loading fails", async () => {
    const controller = renderUiShell();
    vi.mocked(controller.submit).mockRejectedValueOnce(new Error("Query not found."));

    fireEvent.click(screen.getByRole("button", { name: "Edit query Delivery" }));
    const form = await screen.findByRole("form", { name: "Edit saved query" });
    fireEvent.change(within(form).getByRole("textbox", { name: "Query URL or ID" }), {
      target: { value: EDITED_QUERY_URL }
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(controller.submit).toHaveBeenCalledWith(expect.objectContaining({ queryInput: EDITED_QUERY_URL }));
    });
    expect((await screen.findByRole("alert")).textContent).toBe("Query not found.");
    expect(screen.getByRole("form", { name: "Edit saved query" })).toBeTruthy();
    expect(userPreferencesMock.persistUserPreferencesPatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ savedQueries: expect.anything() })
    );
  });
});

function renderUiShell(): QueryIntakeTransport {
  const controller = createController();
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
  return controller;
}

function createController(): QueryIntakeTransport {
  return {
    submit: vi.fn(async () => {
      throw new Error("submit is not expected in this header query test");
    }),
    fetchAdoCommLogs: vi.fn(async () => ({
      entries: [],
      nextSeq: 0
    })),
    adoptWorkItemSchedule: vi.fn(async () => createWriteResult("WORK_ITEM_PATCH")),
    linkDependency: vi.fn(async () => createWriteResult("DEPENDENCY_LINK")),
    updateWorkItemDetails: vi.fn(async () => createWriteResult("WORK_ITEM_PATCH")),
    updateWorkItemState: vi.fn(async () => createWriteResult("WORK_ITEM_PATCH")),
    updateWorkItemAssignedTo: vi.fn(async () => createWriteResult("WORK_ITEM_PATCH")),
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
