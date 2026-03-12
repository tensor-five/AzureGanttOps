// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { WarningBanner } from "./warning-banner.js";

afterEach(() => {
  cleanup();
});

describe("warning-banner", () => {
  it("renders structured warning content without pre block and wires retry action", async () => {
    const user = userEvent.setup();
    const onRetryRefresh = vi.fn();

    render(
      React.createElement(WarningBanner, {
        uiState: "ready_with_lkg_warning",
        guidance: "Latest refresh failed; showing last-known-good timeline.",
        retryActionLabel: "Retry refresh",
        hasStrictFailFallback: true,
        onRetryRefresh
      })
    );

    const banner = screen.getByLabelText("timeline-warning-banner");
    expect(banner.querySelector("pre")).toBeNull();
    expect(banner.textContent).toContain("Strict-fail fallback active");
    expect(banner.textContent).toContain("Action: Retry refresh");

    await user.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(onRetryRefresh).toHaveBeenCalledTimes(1);
  });
});
