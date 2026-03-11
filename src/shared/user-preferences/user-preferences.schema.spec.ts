import { describe, expect, it } from "vitest";

import { sanitizeSavedQueryPreference, sanitizeUserPreferences } from "./user-preferences.schema.js";

describe("user-preferences.schema", () => {
  it("returns empty object for invalid roots", () => {
    expect(sanitizeUserPreferences(null)).toEqual({});
    expect(sanitizeUserPreferences([])).toEqual({});
    expect(sanitizeUserPreferences("x")).toEqual({});
  });

  it("sanitizes array values and preserves existing dedupe semantics", () => {
    const sanitized = sanitizeUserPreferences({
      timelineLabelFields: [" title ", "Custom.Team", "title", "", 13],
      timelineSidebarFields: ["", "Custom.Team", "Custom.Team", "title"]
    });

    expect(sanitized.timelineLabelFields).toEqual(["title", "Custom.Team", "title"]);
    expect(sanitized.timelineSidebarFields).toEqual(["Custom.Team", "title"]);
  });

  it("clamps numeric width preferences and normalizes colors", () => {
    const sanitized = sanitizeUserPreferences({
      timelineSidebarWidthPx: 9999.2,
      timelineDetailsWidthPx: -20,
      timelineSidebarRowJustify: "flex-end",
      timelineFieldColorCoding: {
        fieldRef: "  Custom.Team  ",
        valueColors: {
          alpha: " #ABCDEF ",
          beta: "nope",
          gamma: 3
        }
      }
    });

    expect(sanitized.timelineSidebarWidthPx).toBe(640);
    expect(sanitized.timelineDetailsWidthPx).toBe(0);
    expect(sanitized.timelineSidebarRowJustify).toBe("flex-end");
    expect(sanitized.timelineFieldColorCoding).toEqual({
      fieldRef: "Custom.Team",
      valueColors: {
        alpha: "#abcdef"
      }
    });
  });

  it("sanitizes timeline sort preferences", () => {
    const sanitized = sanitizeUserPreferences({
      timelineSort: {
        primary: " title ",
        secondary: " field:Custom.Team "
      }
    });

    expect(sanitized.timelineSort).toEqual({
      primary: "title",
      secondary: "field:Custom.Team"
    });

    expect(
      sanitizeUserPreferences({
        timelineSort: {
          primary: "unknown",
          secondary: "startDate"
        }
      }).timelineSort
    ).toBeUndefined();
  });

  it("deduplicates saved queries by id and keeps first valid entry", () => {
    const sanitized = sanitizeUserPreferences({
      savedQueries: [
        { id: " a ", name: "First", queryInput: "q1", organization: " org ", project: " p " },
        { id: "a", name: "Second", queryInput: "q2" },
        { id: "", name: "X", queryInput: "q3" }
      ]
    });

    expect(sanitized.savedQueries).toEqual([
      {
        id: "a",
        name: "First",
        queryInput: "q1",
        organization: "org",
        project: "p"
      }
    ]);
  });

  it("normalizes selected header query id and drops empty values", () => {
    expect(
      sanitizeUserPreferences({
        selectedHeaderQueryId: " 42 "
      }).selectedHeaderQueryId
    ).toBe("42");
    expect(
      sanitizeUserPreferences({
        selectedHeaderQueryId: "  "
      }).selectedHeaderQueryId
    ).toBeUndefined();
  });

  it("sanitizes saved query preference", () => {
    expect(
      sanitizeSavedQueryPreference({
        id: "  id-1  ",
        name: "  ",
        queryInput: " q ",
        organization: " contoso ",
        project: " delivery "
      })
    ).toEqual({
      id: "id-1",
      name: "id-1",
      queryInput: "q",
      organization: "contoso",
      project: "delivery"
    });
    expect(sanitizeSavedQueryPreference({ id: "", queryInput: "x" })).toBeNull();
  });
});
