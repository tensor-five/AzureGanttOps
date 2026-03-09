import { describe, expect, it } from "vitest";

import type { CanonicalModel } from "./canonical-model-builder.js";
import { projectTimeline } from "./timeline-projection.js";

describe("projectTimeline", () => {
  it("projects bars, unschedulable items, and dependency filtering with half-open markers", () => {
    const canonical: CanonicalModel = {
      tasks: [
        {
          workItemId: 1,
          mappedId: "WI-1",
          title: "Alpha",
          descriptionHtml: "<p>Alpha</p>",
          workItemType: "Task",
          assignedTo: "Ada",
          parentWorkItemId: null,
          startDate: "2026-03-02T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          state: { code: "Active", badge: "A", color: "#1d4ed8" }
        },
        {
          workItemId: 2,
          mappedId: "WI-2",
          title: "Beta",
          descriptionHtml: null,
          workItemType: "Bug",
          assignedTo: null,
          parentWorkItemId: 1,
          startDate: null,
          endDate: "2026-03-04T00:00:00.000Z",
          state: { code: "New", badge: "N", color: "#7c3aed" }
        },
        {
          workItemId: 3,
          mappedId: "WI-3",
          title: "Gamma",
          descriptionHtml: null,
          workItemType: "Task",
          assignedTo: null,
          parentWorkItemId: null,
          startDate: null,
          endDate: null,
          state: { code: "Closed", badge: "C", color: "#6b7280" }
        }
      ],
      dependencies: [
        {
          predecessorWorkItemId: 1,
          successorWorkItemId: 2,
          relationType: "System.LinkTypes.Dependency-Forward",
          dependencyType: "FS"
        },
        {
          predecessorWorkItemId: 2,
          successorWorkItemId: 3,
          relationType: "System.LinkTypes.Dependency-Forward",
          dependencyType: "FS"
        }
      ]
    };

    const projection = projectTimeline(canonical);

    expect(projection.bars).toHaveLength(2);
    expect(projection.bars[0]).toMatchObject({
      workItemId: 1,
      title: "Alpha",
      state: { code: "Active", badge: "A", color: "#1d4ed8" },
      schedule: {
        startDate: "2026-03-02T00:00:00.000Z",
        endDate: "2026-03-03T00:00:00.000Z",
        missingBoundary: null
      },
      details: {
        mappedId: "WI-1"
      }
    });

    expect(projection.bars[1]).toMatchObject({
      workItemId: 2,
      title: "Beta",
      state: { code: "New", badge: "N", color: "#7c3aed" },
      schedule: {
        startDate: null,
        endDate: "2026-03-04T00:00:00.000Z",
        missingBoundary: "start"
      }
    });

    expect(projection.unschedulable).toEqual([
      {
        workItemId: 3,
        title: "Gamma",
        state: { code: "Closed", badge: "C", color: "#6b7280" },
        details: {
          mappedId: "WI-3",
          descriptionHtml: null,
          workItemType: "Task",
          assignedTo: null,
          parentWorkItemId: null
        },
        reason: "missing-both-dates"
      }
    ]);

    expect(projection.dependencies).toEqual([
      {
        predecessorWorkItemId: 1,
        successorWorkItemId: 2,
        dependencyType: "FS",
        label: "#1 [end] -> #2 [start]"
      }
    ]);

    expect(projection.suppressedDependencies).toEqual([
      {
        predecessorWorkItemId: 2,
        successorWorkItemId: 3,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      }
    ]);
  });

  it("marks end boundary missing when only start date exists", () => {
    const projection = projectTimeline({
      tasks: [
        {
          workItemId: 4,
          mappedId: "WI-4",
          title: "Delta",
          descriptionHtml: null,
          workItemType: "Task",
          assignedTo: null,
          parentWorkItemId: null,
          startDate: "2026-03-05T00:00:00.000Z",
          endDate: null,
          state: { code: "Resolved", badge: "R", color: "#15803d" }
        }
      ],
      dependencies: []
    });

    expect(projection.bars[0].schedule.missingBoundary).toBe("end");
  });
});
