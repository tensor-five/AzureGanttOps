// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { QuerySelector } from "./query-selector.js";
import type { QueryIntakeResponse } from "./query-intake.controller.js";
import { AZURE_SESSION_EXPIRED_QUERY_HINT } from "../../shared/azure-devops/azure-session-recovery.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("query-selector", () => {
  it("explains that Azure login must be refreshed before reload can work", () => {
    render(
      React.createElement(QuerySelector, {
        savedQueries: [],
        onRun: vi.fn(async () => ({}) as QueryIntakeResponse),
        onNeedsFix: vi.fn(),
        authStatus: "SESSION_EXPIRED",
        onAuthenticateAzureCli: vi.fn(async () => ({
          status: "OK" as const,
          message: "Azure CLI login started."
        })),
        onSetAzureCliPath: vi.fn(async () => ({
          status: "OK" as const,
          path: "az"
        }))
      })
    );

    expect(screen.getByRole("button", { name: "Sign in with Azure CLI" })).toBeTruthy();
    expect(screen.getByText(AZURE_SESSION_EXPIRED_QUERY_HINT)).toBeTruthy();
  });

  it("keeps a successful query run when localStorage compatibility writes fail", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        if (
          key === "azure-ganttops.query-input" ||
          key === "azure-ganttops.organization" ||
          key === "azure-ganttops.project"
        ) {
          throw new Error("Quota exceeded");
        }
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      clear: vi.fn(() => {
        values.clear();
      })
    });
    const onRun = vi.fn(async () => ({
      preflightStatus: "READY",
      activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
      mappingValidation: {
        status: "valid",
        issues: []
      }
    }) as unknown as QueryIntakeResponse);

    render(
      React.createElement(QuerySelector, {
        savedQueries: [],
        onRun,
        onNeedsFix: vi.fn(),
        authStatus: null,
        onAuthenticateAzureCli: vi.fn(),
        onSetAzureCliPath: vi.fn()
      })
    );

    fireEvent.change(screen.getByLabelText("Query ID"), {
      target: { value: "37f6f880-0b7b-4350-9f97-7263b40d4e95" }
    });
    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "org" }
    });
    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: "project" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query by ID" }));

    await waitFor(() => {
      expect(onRun).toHaveBeenCalledWith({
        queryId: "https://dev.azure.com/org/project/_queries/query/37f6f880-0b7b-4350-9f97-7263b40d4e95",
        mappingProfileId: undefined
      });
    });
  });
});
