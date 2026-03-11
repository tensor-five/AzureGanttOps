import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { applyTimelineSorting, buildTimelineSortOptions } from "./timeline-sorting.js";

function makeTimeline(): TimelineReadModel {
  return {
    bars: [
      {
        workItemId: 2,
        title: "Beta",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-04T00:00:00.000Z",
          endDate: "2026-03-06T00:00:00.000Z",
          missingBoundary: null
        },
        details: { mappedId: "2", fieldValues: { "Custom.Team": "Beta" } }
      },
      {
        workItemId: 1,
        title: "Alpha",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: { mappedId: "1", fieldValues: { "Custom.Team": "Alpha" } }
      }
    ],
    unschedulable: [],
    dependencies: [],
    suppressedDependencies: [],
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

describe("timeline-sorting", () => {
  it("sorts by primary then secondary fields", () => {
    const sorted = applyTimelineSorting(makeTimeline(), {
      primary: "title",
      secondary: "startDate"
    });

    expect(sorted?.bars.map((bar) => bar.workItemId)).toEqual([1, 2]);
  });

  it("exposes built-in and dynamic sort options", () => {
    const options = buildTimelineSortOptions(["Custom.Team"]);
    expect(options.some((option) => option.value === "startDate")).toBe(true);
    expect(options.some((option) => option.value === "field:Custom.Team")).toBe(true);
  });
});
