// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TrustBadge, renderTrustBadgeLine } from "./trust-badge.js";

afterEach(() => {
  cleanup();
});

describe("trust-badge", () => {
  it("keeps closed trigger neutral for every trust state", () => {
    const { rerender } = renderTrustBadge({
      statusCode: "OK",
      trustState: "ready",
      lastRefreshAt: "2026-03-09T07:00:00.000Z"
    });

    for (const trustState of ["ready", "needs_attention", "partial_failure"] as const) {
      rerender(
        React.createElement(TrustBadge, {
          statusCode: trustState === "partial_failure" ? "QUERY_FAILED" : "OK",
          trustState,
          lastRefreshAt: "2026-03-09T07:00:00.000Z",
          readOnlyTimeline: true
        })
      );

      const badge = screen.getByLabelText("Status");
      const summary = badge.querySelector("summary");

      expect(summary?.textContent).toBe("Status");
      expect(badge.textContent).toBe("Status");
      expect(badge.textContent).not.toContain("OK");
      expect(badge.textContent).not.toContain("Trust");
      expect(badge.textContent).not.toContain("Partial failure");
      expect(badge.textContent).not.toContain("last-updated");
    }
  });

  it("reveals status details and controls on click", async () => {
    const user = userEvent.setup();

    renderTrustBadge({
      statusCode: "QUERY_FAILED",
      trustState: "partial_failure",
      lastRefreshAt: null,
      controlsContent: React.createElement("button", { type: "button" }, "Refresh controls")
    });

    const badge = screen.getByLabelText("Status") as HTMLDetailsElement;

    expect(badge.open).toBe(false);
    expect(screen.queryByText("[QUERY_FAILED] Partial failure")).toBeNull();
    expect(screen.queryByLabelText("controls-menu")).toBeNull();

    await user.click(screen.getByText("Status"));

    expect(badge.open).toBe(true);
    expect(badge.textContent).toContain("[QUERY_FAILED] Partial failure");
    expect(badge.textContent).toContain("last-updated");
    expect(screen.getByLabelText("controls-menu").textContent).toContain("Refresh controls");
    expect(badge.textContent).not.toContain("Trust state");
    expect(badge.textContent).not.toContain("read-only");
  });

  it("keeps plain status-line export stable for textual diagnostics", () => {
    expect(
      renderTrustBadgeLine({
        statusCode: "QUERY_FAILED",
        trustState: "partial_failure",
        lastRefreshAt: null,
        readOnlyTimeline: false
      })
    ).toBe("[QUERY_FAILED] Partial failure | last-updated=none");
  });
});

function renderTrustBadge(props: Omit<TrustBadgeModelDefaults, "readOnlyTimeline">) {
  return render(
    React.createElement(TrustBadge, {
      readOnlyTimeline: true,
      ...props
    })
  );
}

type TrustBadgeModelDefaults = React.ComponentProps<typeof TrustBadge>;
