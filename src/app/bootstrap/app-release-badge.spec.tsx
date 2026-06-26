// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_VERSION, CHANGELOG_PATH } from "../../shared/project-meta/project-meta.js";
import { AppReleaseBadge } from "./app-release-badge.js";

describe("AppReleaseBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a visible, accessible changelog link for the current version", () => {
    render(React.createElement(AppReleaseBadge));

    const link = screen.getByRole("link", {
      name: `Changelog zu Version ${APP_VERSION} öffnen`
    }) as HTMLAnchorElement;

    expect(link.textContent).toBe(`Changelog v${APP_VERSION}`);
    expect(link.getAttribute("href")).toBe(CHANGELOG_PATH);
    expect(link.getAttribute("title")).toBe(`Changelog zu Version ${APP_VERSION} öffnen`);
  });
});
