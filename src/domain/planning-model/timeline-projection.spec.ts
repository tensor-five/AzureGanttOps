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
          fieldValues: {},
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
          fieldValues: {},
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
          fieldValues: {},
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
      workItemId: 2,
      title: "Beta",
      state: { code: "New", badge: "N", color: "#7c3aed" },
      schedule: {
        startDate: null,
        endDate: "2026-03-04T00:00:00.000Z",
        missingBoundary: "start"
      },
      details: {
        mappedId: "WI-2"
      }
    });

    expect(projection.bars[1]).toMatchObject({
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

    expect(projection.unschedulable).toEqual([
      {
        workItemId: 3,
        title: "Gamma",
        state: { code: "Closed", badge: "C", color: "#6b7280" },
        details: {
          mappedId: "WI-3",
          descriptionHtml: null,
          workItemType: "Task",
          fieldValues: {},
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
          fieldValues: {},
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

  it("sorts end-only bars by derived 14-day fallback start", () => {
    const projection = projectTimeline({
      tasks: [
        {
          workItemId: 10,
          mappedId: "WI-10",
          title: "End only",
          descriptionHtml: null,
          workItemType: "Task",
          fieldValues: {},
          assignedTo: null,
          parentWorkItemId: null,
          startDate: null,
          endDate: "2026-03-20T00:00:00.000Z",
          state: { code: "Active", badge: "A", color: "#1d4ed8" }
        },
        {
          workItemId: 20,
          mappedId: "WI-20",
          title: "Has start",
          descriptionHtml: null,
          workItemType: "Task",
          fieldValues: {},
          assignedTo: null,
          parentWorkItemId: null,
          startDate: "2026-03-10T00:00:00.000Z",
          endDate: "2026-03-12T00:00:00.000Z",
          state: { code: "Active", badge: "A", color: "#1d4ed8" }
        }
      ],
      dependencies: []
    });

    expect(projection.bars.map((bar) => bar.workItemId)).toEqual([10, 20]);
  });

  it("uses iteration dates as fallback when explicit dates are missing", () => {
    const projection = projectTimeline(
      {
        tasks: [
          {
            workItemId: 100,
            mappedId: "WI-100",
            title: "No explicit dates but has iteration",
            descriptionHtml: null,
            workItemType: "Task",
            fieldValues: {
              "System.IterationPath": "MyProject\\Sprint 1"
            },
            assignedTo: null,
            parentWorkItemId: null,
            startDate: null,
            endDate: null,
            state: { code: "Active", badge: "A", color: "#1d4ed8" }
          }
        ],
        dependencies: []
      },
      undefined,
      {
        "MyProject\\Sprint 1": {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-14T00:00:00.000Z"
        }
      }
    );

    expect(projection.bars).toHaveLength(1);
    expect(projection.bars[0]).toMatchObject({
      workItemId: 100,
      title: "No explicit dates but has iteration",
      schedule: {
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-14T00:00:00.000Z",
        missingBoundary: null,
        isIterationFallback: true
      }
    });
    expect(projection.unschedulable).toHaveLength(0);
  });

  it("prefers explicit dates over iteration dates", () => {
    const projection = projectTimeline(
      {
        tasks: [
          {
            workItemId: 101,
            mappedId: "WI-101",
            title: "Has both explicit and iteration dates",
            descriptionHtml: null,
            workItemType: "Task",
            fieldValues: {
              "System.IterationPath": "MyProject\\Sprint 1"
            },
            assignedTo: null,
            parentWorkItemId: null,
            startDate: "2026-03-05T00:00:00.000Z",
            endDate: "2026-03-08T00:00:00.000Z",
            state: { code: "Active", badge: "A", color: "#1d4ed8" }
          }
        ],
        dependencies: []
      },
      undefined,
      {
        "MyProject\\Sprint 1": {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-14T00:00:00.000Z"
        }
      }
    );

    expect(projection.bars).toHaveLength(1);
    expect(projection.bars[0]).toMatchObject({
      workItemId: 101,
      title: "Has both explicit and iteration dates",
      schedule: {
        startDate: "2026-03-05T00:00:00.000Z",
        endDate: "2026-03-08T00:00:00.000Z",
        missingBoundary: null
      }
    });
    expect(projection.bars[0].schedule.isIterationFallback).toBeUndefined();
  });

  it("remains unschedulable when iteration dates unavailable", () => {
    const projection = projectTimeline(
      {
        tasks: [
          {
            workItemId: 102,
            mappedId: "WI-102",
            title: "Has iteration path but no date metadata",
            descriptionHtml: null,
            workItemType: "Task",
            fieldValues: {
              "System.IterationPath": "MyProject\\Future Sprint"
            },
            assignedTo: null,
            parentWorkItemId: null,
            startDate: null,
            endDate: null,
            state: { code: "Active", badge: "A", color: "#1d4ed8" }
          }
        ],
        dependencies: []
      },
      undefined,
      {
        "MyProject\\Sprint 1": {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-14T00:00:00.000Z"
        }
      }
    );

    expect(projection.bars).toHaveLength(0);
    expect(projection.unschedulable).toHaveLength(1);
    expect(projection.unschedulable[0]).toMatchObject({
      workItemId: 102,
      title: "Has iteration path but no date metadata",
      reason: "missing-both-dates"
    });
  });

  it("remains unschedulable when no iteration dates provided", () => {
    const projection = projectTimeline({
      tasks: [
        {
          workItemId: 103,
          mappedId: "WI-103",
          title: "No dates, no iteration dates map",
          descriptionHtml: null,
          workItemType: "Task",
          fieldValues: {
            "System.IterationPath": "MyProject\\Sprint 1"
          },
          assignedTo: null,
          parentWorkItemId: null,
          startDate: null,
          endDate: null,
          state: { code: "Active", badge: "A", color: "#1d4ed8" }
        }
      ],
      dependencies: []
    });

    expect(projection.bars).toHaveLength(0);
    expect(projection.unschedulable).toHaveLength(1);
    expect(projection.unschedulable[0]).toMatchObject({
      workItemId: 103,
      title: "No dates, no iteration dates map",
      reason: "missing-both-dates"
    });
  });
});

