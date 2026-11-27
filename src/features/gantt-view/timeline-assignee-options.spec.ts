import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { buildTimelineAssigneeOptions } from "./timeline-assignee-options.js";

describe("buildTimelineAssigneeOptions", () => {
  it("sorts people from the complete timeline by assigned task count", () => {
    const timeline = makeTimeline(["Zoë", "Anna", " zoë ", "Berta"], ["Anna", null, "Zoë"]);

    expect(buildTimelineAssigneeOptions(timeline)).toEqual([
      { name: "Zoë", taskCount: 3 },
      { name: "Anna", taskCount: 2 },
      { name: "Berta", taskCount: 1 }
    ]);
  });

  it("sorts ties alphabetically and ignores empty values", () => {
    const timeline = makeTimeline(["Christian", "Anna", "  "], [null]);

    expect(buildTimelineAssigneeOptions(timeline)).toEqual([
      { name: "Anna", taskCount: 1 },
      { name: "Christian", taskCount: 1 }
    ]);
  });
});

function makeTimeline(
  scheduledAssignees: Array<string | null>,
  unscheduledAssignees: Array<string | null>
): TimelineReadModel {
  return {
    queryType: "flat",
    bars: scheduledAssignees.map((assignedTo, index) => ({
      workItemId: index + 1,
      title: `Task ${index + 1}`,
      state: { code: "Active", badge: "A", color: "#000000" },
      schedule: {
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-02T00:00:00.000Z",
        missingBoundary: null
      },
      details: { mappedId: String(index + 1), assignedTo }
    })),
    unschedulable: unscheduledAssignees.map((assignedTo, index) => ({
      workItemId: scheduledAssignees.length + index + 1,
      title: `Task ${scheduledAssignees.length + index + 1}`,
      state: { code: "New", badge: "N", color: "#000000" },
      details: {
        mappedId: String(scheduledAssignees.length + index + 1),
        assignedTo
      },
      reason: "missing-both-dates"
    })),
    dependencies: [],
    suppressedDependencies: [],
    mappingValidation: { status: "valid", issues: [] },
    treeLayout: null
  };
}
