import { describe, expect, it } from "vitest";

import {
  clearTimelineColorCodingPreferenceForTests,
  loadLastTimelineColorCoding,
  saveLastTimelineColorCoding
} from "./timeline-color-coding-preference.js";

describe("timeline-color-coding-preference", () => {
  it("returns null when no prior color coding exists", () => {
    clearTimelineColorCodingPreferenceForTests();
    expect(loadLastTimelineColorCoding()).toBeNull();
  });

  it("persists and loads person color coding", () => {
    clearTimelineColorCodingPreferenceForTests();
    saveLastTimelineColorCoding("person");
    expect(loadLastTimelineColorCoding()).toBe("person");
  });

  it("persists and loads overdue color coding", () => {
    clearTimelineColorCodingPreferenceForTests();
    saveLastTimelineColorCoding("overdue");
    expect(loadLastTimelineColorCoding()).toBe("overdue");
  });
});
