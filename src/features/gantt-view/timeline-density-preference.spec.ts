import { describe, expect, it, beforeEach } from "vitest";

import {
  clearTimelineDensityPreferenceForTests,
  loadLastDensity,
  saveLastDensity
} from "./timeline-density-preference.js";

describe("timeline-density-preference", () => {
  beforeEach(() => {
    clearTimelineDensityPreferenceForTests();
  });

  it("returns null when no prior density exists", () => {
    expect(loadLastDensity()).toBeNull();
  });

  it("persists and loads comfortable density", () => {
    saveLastDensity("comfortable");

    expect(loadLastDensity()).toBe("comfortable");
  });

  it("persists and loads compact density", () => {
    saveLastDensity("compact");

    expect(loadLastDensity()).toBe("compact");
  });

  it("overwrites prior value with latest explicit choice", () => {
    saveLastDensity("comfortable");
    saveLastDensity("compact");

    expect(loadLastDensity()).toBe("compact");
  });

  it("persists density per query id", () => {
    saveLastDensity("comfortable", "query-a");
    saveLastDensity("compact", "query-b");

    expect(loadLastDensity("query-a")).toBe("comfortable");
    expect(loadLastDensity("query-b")).toBe("compact");
  });
});
