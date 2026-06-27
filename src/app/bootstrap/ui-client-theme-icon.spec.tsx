// @vitest-environment jsdom

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userPreferencesMock = vi.hoisted(() => {
  const preferences = {
    themeMode: "system" as const,
    selectedHeaderQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
    savedQueries: [
      {
        id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        name: "Delivery",
        queryInput: "https://dev.azure.com/contoso/delivery/_queries/query/37f6f880-0b7b-4350-9f97-7263b40d4e95"
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

vi.mock("../../shared/user-preferences/user-preferences.client.js", () => ({
  getCachedUserPreferences: userPreferencesMock.getCachedUserPreferences,
  hydrateUserPreferences: userPreferencesMock.hydrateUserPreferences,
  persistUserPreferencesPatch: userPreferencesMock.persistUserPreferencesPatch
}));

import {
  createDefaultUiShellComposition,
  UiShellApp
} from "./ui-client.js";
import type {
  QueryIntakeTransport,
  WriteCommandTransportResult
} from "../composition/ui-shell.composition.js";
import { APP_VERSION } from "../../shared/project-meta/project-meta.js";

const originalMatchMedia = window.matchMedia;

describe("ui-client system theme icon", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
    document.documentElement.dataset.themeMode = "";
    document.documentElement.dataset.theme = "";
    userPreferencesMock.getCachedUserPreferences.mockClear();
    userPreferencesMock.hydrateUserPreferences.mockClear();
    userPreferencesMock.persistUserPreferencesPatch.mockClear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    document.documentElement.dataset.themeMode = "";
    document.documentElement.dataset.theme = "";
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia
    });
  });

  it("switches the rendered system theme icon when matchMedia emits a change", async () => {
    const colorScheme = installControlledColorScheme(false);
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

    const themeButton = await screen.findByRole("button", {
      name: "Switch theme (current: System)"
    });

    await waitFor(() => {
      expect(colorScheme.listenerCount()).toBeGreaterThan(0);
    });

    expect(themeButton.textContent).toBe("☀");
    expect(document.documentElement.dataset.themeMode).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");

    await act(async () => {
      colorScheme.setMatches(true);
    });

    await waitFor(() => {
      expect(themeButton.textContent).toBe("☾");
    });
    expect(document.documentElement.dataset.themeMode).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");

    await act(async () => {
      colorScheme.setMatches(false);
    });

    await waitFor(() => {
      expect(themeButton.textContent).toBe("☀");
    });
    expect(document.documentElement.dataset.themeMode).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

function installControlledColorScheme(initialMatches: boolean): {
  listenerCount: () => number;
  setMatches: (nextMatches: boolean) => void;
} {
  const media = "(prefers-color-scheme: dark)";
  let matches = initialMatches;
  const listeners = new Set<MediaQueryChangeListener>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: vi.fn((type: string, listener: MediaQueryChangeListener) => {
      if (type === "change") {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((type: string, listener: MediaQueryChangeListener) => {
      if (type === "change") {
        listeners.delete(listener);
      }
    }),
    addListener: vi.fn((listener: MediaQueryChangeListener) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: MediaQueryChangeListener) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(() => true)
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQueryList)
  });

  return {
    listenerCount: () => listeners.size,
    setMatches: (nextMatches: boolean) => {
      matches = nextMatches;
      const event = {
        matches,
        media
      } as MediaQueryListEvent;

      for (const listener of listeners) {
        notifyMediaQueryChangeListener(listener, mediaQueryList, event);
      }

      if (typeof mediaQueryList.onchange === "function") {
        mediaQueryList.onchange.call(mediaQueryList, event);
      }
    }
  };
}

type MediaQueryChangeListener =
  | ((this: MediaQueryList, event: MediaQueryListEvent) => void)
  | {
      handleEvent: (event: MediaQueryListEvent) => void;
    };

function notifyMediaQueryChangeListener(
  listener: MediaQueryChangeListener,
  mediaQueryList: MediaQueryList,
  event: MediaQueryListEvent
): void {
  if (typeof listener === "function") {
    listener.call(mediaQueryList, event);
    return;
  }

  listener.handleEvent(event);
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

function createController(): QueryIntakeTransport {
  return {
    submit: vi.fn(async () => {
      throw new Error("submit should not be called by the theme icon test");
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
      message: "Azure CLI login is available in the theme icon test."
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
      status: "unavailable" as const,
      currentVersion: APP_VERSION,
      checkedAt: new Date().toISOString(),
      source: "github" as const,
      reason: "version_source_failed" as const
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
