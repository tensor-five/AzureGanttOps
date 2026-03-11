import { describe, expect, it } from "vitest";

import { sanitizeTimelineSortField, sanitizeTimelineSortPreference } from "./timeline-sort-preference.js";

describe("timeline-sort-preference", () => {
  it("accepts built-in and field sort values", () => {
    expect(sanitizeTimelineSortField("startDate")).toBe("startDate");
    expect(sanitizeTimelineSortField(" field:Custom.Team ")).toBe("field:Custom.Team");
  });

  it("normalizes duplicate primary/secondary with Start date fallback", () => {
    expect(
      sanitizeTimelineSortPreference({
        primary: "title",
        secondary: "title"
      })
    ).toEqual({
      primary: "title",
      secondary: "startDate"
    });
  });
});
