// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { DiagnosticsTab } from "./diagnostics-tab.js";

afterEach(() => {
  cleanup();
});

describe("diagnostics-tab", () => {
  it("renders diagnostics rows as list items and keeps retry interaction", async () => {
    const user = userEvent.setup();
    const onRetryRefresh = vi.fn();

    render(
      React.createElement(DiagnosticsTab, {
        statusCode: "OK",
        errorCode: null,
        guidance: null,
        sourceHealth: "HEALTHY",
        activeQueryId: "q-1",
        lastRefreshAt: "2026-03-09T07:00:00.000Z",
        reloadSource: "full_reload",
        onRetryRefresh
      })
    );

    const panel = screen.getByLabelText("diagnostics-tab");
    expect(panel.querySelector("pre")).toBeNull();
    expect(panel.textContent).toContain("source health: HEALTHY");
    expect(panel.textContent).toContain("active query source: q-1");

    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(onRetryRefresh).toHaveBeenCalledTimes(1);
  });
});
