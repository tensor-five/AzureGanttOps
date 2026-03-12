import { describe, expect, it } from "vitest";

import {
  clearTimelineColorCodingPreferenceForTests,
  loadLastTimelineColorCoding,
  loadTimelineFieldColorCodingConfig,
  saveLastTimelineColorCoding,
  saveTimelineFieldColorCodingConfig
} from "./timeline-color-coding-preference.js";

describe("timeline-color-coding-preference", () => {
  it("returns null when no prior color coding exists", () => {
    clearTimelineColorCodingPreferenceForTests();
    expect(loadLastTimelineColorCoding()).toBeNull();
  });

  it("persists and loads status color coding", () => {
    clearTimelineColorCodingPreferenceForTests();
    saveLastTimelineColorCoding("status");
    expect(loadLastTimelineColorCoding()).toBe("status");
  });

  it("persists and loads overdue color coding", () => {
    clearTimelineColorCodingPreferenceForTests();
    saveLastTimelineColorCoding("overdue");
    expect(loadLastTimelineColorCoding()).toBe("overdue");
  });

  it("persists and loads field color coding mode", () => {
    clearTimelineColorCodingPreferenceForTests();
    saveLastTimelineColorCoding("field");
    expect(loadLastTimelineColorCoding()).toBe("field");
  });

  it("returns empty field coding config by default", () => {
    clearTimelineColorCodingPreferenceForTests();
    expect(loadTimelineFieldColorCodingConfig()).toEqual({
      fieldRef: null,
      valueColors: {},
      overdueExcludedStateCodes: ["closed", "done", "removed", "completed"]
    });
  });

  it("persists and sanitizes field color coding config", () => {
    clearTimelineColorCodingPreferenceForTests();
    saveTimelineFieldColorCodingConfig({
      fieldRef: " Custom.Team ",
      valueColors: {
        "Custom.Team::Alpha": " #FF00AA ",
        "Custom.Team::Beta": "blue"
      },
      overdueExcludedStateCodes: [" DONE ", "resolved", ""]
    });

    expect(loadTimelineFieldColorCodingConfig()).toEqual({
      fieldRef: "Custom.Team",
      valueColors: {
        "Custom.Team::Alpha": "#ff00aa"
      },
      overdueExcludedStateCodes: ["done", "resolved"]
    });
  });
});
