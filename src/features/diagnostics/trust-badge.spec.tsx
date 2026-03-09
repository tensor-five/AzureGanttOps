import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TrustBadge, renderTrustBadgeLine } from "./trust-badge.js";

afterEach(() => {
  cleanup();
});

describe("trust-badge", () => {
  it("renders compact trust badge and reveals status details on click", () => {
    render(
      React.createElement(TrustBadge, {
        statusCode: "OK",
        trustState: "ready",
        lastRefreshAt: "2026-03-09T07:00:00.000Z",
        readOnlyTimeline: true
      })
    );

    const badge = screen.getByLabelText("global-trust-badge");
    expect(badge.querySelector("summary")?.textContent).toContain("Trust OK");

    fireEvent.click(screen.getByText("Trust OK"));
    expect(badge.textContent).toContain("[OK] Ready");
    expect(badge.textContent).toContain("last-updated");
    expect(badge.textContent).toContain("read-only");
  });

  it("keeps plain status-line export stable for textual diagnostics", () => {
    expect(
      renderTrustBadgeLine({
        statusCode: "QUERY_FAILED",
        trustState: "partial_failure",
        lastRefreshAt: null,
        readOnlyTimeline: false
      })
    ).toBe("[QUERY_FAILED] Partial failure | last-updated=none | read-only=false");
  });
});
