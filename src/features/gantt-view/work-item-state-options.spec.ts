import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { resolveWorkItemStateOptions } from "./work-item-state-options.js";

function makeTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 1,
        title: "One",
        state: { code: "Active", badge: "A", color: "#111111" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-02T00:00:00.000Z",
          missingBoundary: null
        },
        details: { mappedId: "1" }
      }
    ],
    unschedulable: [
      {
        workItemId: 2,
        title: "Two",
        state: { code: "Blocked", badge: "B", color: "#222222" },
        details: { mappedId: "2" },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: { status: "valid", issues: [] }
  };
}

describe("resolveWorkItemStateOptions", () => {
  it("prefers server options and keeps their order", () => {
    expect(
      resolveWorkItemStateOptions({
        timeline: makeTimeline(),
        selectedState: "Active",
        serverStateOptions: [
          { name: "Ready", color: "111111" },
          { name: "Doing", color: "222222" }
        ]
      })
    ).toEqual([
      { name: "Active", color: null },
      { name: "Ready", color: "111111" },
      { name: "Doing", color: "222222" }
    ]);
  });

  it("always includes the current state without duplicating server options", () => {
    expect(
      resolveWorkItemStateOptions({
        timeline: makeTimeline(),
        selectedState: " active ",
        serverStateOptions: [{ name: "Active", color: "00ff00" }]
      })
    ).toEqual([{ name: "Active", color: "00ff00" }]);
  });

  it("falls back to known state order and appends discovered custom states", () => {
    const options = resolveWorkItemStateOptions({
      timeline: makeTimeline(),
      selectedState: "QA",
      serverStateOptions: []
    });

    expect(options.map((option) => option.name)).toEqual([
      "To Do",
      "New",
      "Active",
      "Resolved",
      "Closed",
      "Done",
      "Blocked",
      "QA"
    ]);
  });
});
