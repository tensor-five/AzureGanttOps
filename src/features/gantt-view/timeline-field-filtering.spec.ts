import { describe, expect, it } from "vitest";

import {
  EMPTY_FIELD_FILTER_KEY,
  extractFilterMatchKeys,
  extractFilterValueTokens,
  isTagFieldRef
} from "./timeline-field-filtering.js";

describe("timeline-field-filtering", () => {
  it("detects tag fields by leaf name", () => {
    expect(isTagFieldRef("System.Tags")).toBe(true);
    expect(isTagFieldRef("Custom.Tag")).toBe(true);
    expect(isTagFieldRef("Custom.Team")).toBe(false);
  });

  it("splits semicolon tag values into individual filter tokens", () => {
    expect(extractFilterValueTokens("System.Tags", "alpha; platform ;alpha")).toEqual([
      { key: "alpha", label: "alpha" },
      { key: "platform", label: "platform" }
    ]);
  });

  it("returns Empty token when tag value is blank", () => {
    expect(extractFilterValueTokens("System.Tags", " ; ")).toEqual([
      { key: EMPTY_FIELD_FILTER_KEY, label: "Empty" }
    ]);
  });

  it("keeps non-tag fields as a single exact key", () => {
    expect(extractFilterValueTokens("Custom.Team", "Alpha")).toEqual([{ key: "Alpha", label: "Alpha" }]);
    expect(extractFilterMatchKeys("Custom.Team", "Alpha")).toEqual(["Alpha"]);
  });

  it("adds legacy raw tag value key to preserve old URL filters", () => {
    expect(extractFilterMatchKeys("System.Tags", "alpha;platform")).toEqual([
      "alpha",
      "platform",
      "alpha;platform"
    ]);
  });
});
