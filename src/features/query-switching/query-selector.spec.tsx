// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { QuerySelector } from "./query-selector.js";
import type { QueryIntakeResponse } from "./query-intake.controller.js";
import { AZURE_SESSION_EXPIRED_QUERY_HINT } from "../../shared/azure-devops/azure-session-recovery.js";

afterEach(() => {
  cleanup();
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
});
