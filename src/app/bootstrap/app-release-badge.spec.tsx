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
    render(
      React.createElement(AppReleaseBadge, {
        open: false,
        onVersionClick: vi.fn(),
        onShortcutsClick: vi.fn()
      })
    );

    const button = screen.getByRole("button", {
      name: `Changelog zu Version ${APP_VERSION} öffnen`
    }) as HTMLButtonElement;

    expect(button.textContent).toBe(`v${APP_VERSION}`);
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("title")).toBe(`Changelog zu Version ${APP_VERSION} öffnen`);
    expect(screen.queryByRole("button", { name: /Neue Version verfügbar/ })).toBeNull();
  });

  it("reflects the expanded state and delegates clicks to the caller", () => {
    const onVersionClick = vi.fn();
    render(React.createElement(AppReleaseBadge, { open: true, onVersionClick, onShortcutsClick: vi.fn() }));

    const button = screen.getByRole("button", {
      name: `Changelog zu Version ${APP_VERSION} öffnen`
    });

    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(button);

    expect(onVersionClick).toHaveBeenCalledTimes(1);
  });

  it("renders a keyboard shortcuts button next to the version", () => {
    const onShortcutsClick = vi.fn();
    render(
      React.createElement(AppReleaseBadge, {
        open: false,
        shortcutsOpen: true,
        onVersionClick: vi.fn(),
        onShortcutsClick
      })
    );

    const button = screen.getByRole("button", {
      name: "Tastenkombinationen öffnen"
    });

    expect(button.textContent).toBe("⌘");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("title")).toBe("Tastenkombinationen öffnen");

    fireEvent.click(button);

    expect(onShortcutsClick).toHaveBeenCalledTimes(1);
  });

  it("renders the optional update indicator as a sibling button", () => {
    const onUpdateClick = vi.fn();
    render(
      React.createElement(AppReleaseBadge, {
        open: false,
        updateAvailable: true,
        onVersionClick: vi.fn(),
        onShortcutsClick: vi.fn(),
        onUpdateClick
      })
    );

    const versionButton = screen.getByRole("button", {
      name: `Changelog zu Version ${APP_VERSION} öffnen`
    });
    const updateButton = screen.getByRole("button", {
      name: "Neue Version verfügbar. Changelog mit Update-Hinweis öffnen"
    });

    expect(versionButton.contains(updateButton)).toBe(false);
    expect(updateButton.textContent).toBe("!");
    expect(updateButton.getAttribute("aria-haspopup")).toBe("dialog");
    expect(updateButton.getAttribute("title")).toBe("Neue Version verfügbar");

    fireEvent.click(updateButton);

    expect(onUpdateClick).toHaveBeenCalledTimes(1);
  });
});
