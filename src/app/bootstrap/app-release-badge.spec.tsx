// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_VERSION } from "../../shared/project-meta/project-meta.js";
import { AppReleaseBadge } from "./app-release-badge.js";

describe("AppReleaseBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a visible, accessible changelog dialog button for the current version", () => {
    render(React.createElement(AppReleaseBadge, { open: false, onClick: vi.fn() }));

    const button = screen.getByRole("button", {
      name: `Changelog zu Version ${APP_VERSION} öffnen`
    }) as HTMLButtonElement;

    expect(button.textContent).toBe(`v${APP_VERSION}`);
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("title")).toBe(`Changelog zu Version ${APP_VERSION} öffnen`);
  });

  it("reflects the expanded state and delegates clicks to the caller", () => {
    const onClick = vi.fn();
    render(React.createElement(AppReleaseBadge, { open: true, onClick }));

    const button = screen.getByRole("button", {
      name: `Changelog zu Version ${APP_VERSION} öffnen`
    });

    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
