// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyThemeMode,
  iconForThemeMode,
  labelForThemeMode,
  nextThemeMode,
  persistThemeMode,
  readPersistedThemeMode,
  resolveEffectiveTheme
} from "./ui-client-theme.js";

describe("ui-client-theme", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.dataset.themeMode = "";
    document.documentElement.dataset.theme = "";
  });

  it("resolves and cycles theme modes", () => {
    expect(resolveEffectiveTheme("dark")).toBe("dark");
    expect(resolveEffectiveTheme("light")).toBe("light");
    expect(nextThemeMode("system")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("light");
    expect(nextThemeMode("light")).toBe("system");
    expect(iconForThemeMode("system")).toBe("◩");
    expect(labelForThemeMode("dark")).toBe("Dark");
  });

  it("persists and applies theme mode", () => {
    persistThemeMode("theme-key", "light");
    expect(readPersistedThemeMode("theme-key", null)).toBe("light");

    applyThemeMode("dark");
    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("uses system preference for effective theme", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMedia
    });

    expect(resolveEffectiveTheme("system")).toBe("dark");
  });
});
