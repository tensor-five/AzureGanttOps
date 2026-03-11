import { beforeEach, describe, expect, it } from "vitest";

import {
  clearTimelineSidebarRowJustifyPreferenceForTests,
  loadLastTimelineSidebarRowJustify,
  saveTimelineSidebarRowJustify
} from "./timeline-sidebar-row-justify-preference.js";

describe("timeline-sidebar-row-justify-preference", () => {
  beforeEach(() => {
    clearTimelineSidebarRowJustifyPreferenceForTests();
  });

  it("returns null when no prior justify preference exists", () => {
    expect(loadLastTimelineSidebarRowJustify()).toBeNull();
  });

  it("persists and loads flex-start", () => {
    saveTimelineSidebarRowJustify("flex-start");

    expect(loadLastTimelineSidebarRowJustify()).toBe("flex-start");
  });

  it("persists and loads flex-end", () => {
    saveTimelineSidebarRowJustify("flex-end");

    expect(loadLastTimelineSidebarRowJustify()).toBe("flex-end");
  });
});
