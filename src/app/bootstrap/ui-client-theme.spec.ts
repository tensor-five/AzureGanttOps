// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyThemeMode,
  iconForEffectiveTheme,
  labelForThemeMode,
  nextThemeMode,
  persistThemeMode,
  readPersistedThemeMode,
  resolveEffectiveTheme
} from "./ui-client-theme.js";

const originalMatchMedia = window.matchMedia;

describe("ui-client-theme", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    document.documentElement.dataset.themeMode = "";
    document.documentElement.dataset.theme = "";
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia
    });
  });

  it("resolves and cycles theme modes", () => {
    expect(resolveEffectiveTheme("dark")).toBe("dark");
    expect(resolveEffectiveTheme("light")).toBe("light");
    expect(nextThemeMode("system")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("light");
    expect(nextThemeMode("light")).toBe("system");
    expect(iconForEffectiveTheme("light")).toBe("☀");
    expect(iconForEffectiveTheme("dark")).toBe("☾");
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
    let prefersDark = true;
    const matchMedia = vi.fn().mockImplementation(() => ({ matches: prefersDark }));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: matchMedia
    });

    expect(resolveEffectiveTheme("system")).toBe("dark");
    expect(iconForEffectiveTheme(resolveEffectiveTheme("system"))).toBe("☾");

    prefersDark = false;
    expect(resolveEffectiveTheme("system")).toBe("light");
    expect(iconForEffectiveTheme(resolveEffectiveTheme("system"))).toBe("☀");
  });

  it("falls back to light when system preference cannot be read", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined
    });

    expect(resolveEffectiveTheme("system")).toBe("light");
  });
});

function installMemoryStorage(): void {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    })
  });
}
