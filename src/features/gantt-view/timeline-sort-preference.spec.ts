import { describe, expect, it } from "vitest";

import {
  sanitizeTimelineSortDirection,
  sanitizeTimelineSortField,
  sanitizeTimelineSortPreference
} from "./timeline-sort-preference.js";

describe("timeline-sort-preference", () => {
  it("accepts built-in and field sort values", () => {
    expect(sanitizeTimelineSortField("startDate")).toBe("startDate");
    expect(sanitizeTimelineSortField(" field:Custom.Team ")).toBe("field:Custom.Team");
  });

  it("normalizes duplicate primary/secondary with Start date fallback", () => {
    expect(
      sanitizeTimelineSortPreference({
        primary: "title",
        primaryDirection: "desc",
        secondary: "title",
        secondaryDirection: "desc"
      })
    ).toEqual({
      primary: "title",
      primaryDirection: "desc",
      secondary: "startDate",
      secondaryDirection: "desc"
    });
  });

  it("defaults missing sort directions to ascending", () => {
    expect(
      sanitizeTimelineSortPreference({
        primary: "title",
        secondary: null
      })
    ).toEqual({
      primary: "title",
      primaryDirection: "asc",
      secondary: null,
      secondaryDirection: "asc"
    });
  });

  it("accepts ascending and descending directions", () => {
    expect(sanitizeTimelineSortDirection("asc")).toBe("asc");
    expect(sanitizeTimelineSortDirection("desc")).toBe("desc");
    expect(sanitizeTimelineSortDirection("sideways")).toBeNull();
  });
});
