import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import {
  applyCreatedChildWorkItemToResponse,
  applyCreatedChildWorkItemUpdate,
  applyDependencyLinkUpdate,
  applyDuplicateWorkItemToResponse,
  applyDuplicateWorkItemUpdate,
  applyScheduleUpdate,
  applyWorkItemMetadataUpdate,
  applyWorkItemStateUpdate
} from "./ui-client-timeline-mutations.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

function makeTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 11,
        title: "Item 11",
        state: { code: "Active", badge: "A", color: "#111111" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "11",
          descriptionHtml: "<p>a</p>"
        }
      }
    ],
    unschedulable: [
      {
        workItemId: 22,
        title: "Item 22",
        state: { code: "New", badge: "N", color: "#222222" },
        details: {
          mappedId: "22",
          descriptionHtml: "<p>b</p>"
        },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

function makeTreeTimeline(): TimelineReadModel {
  const base = makeTimeline();
  const makeBar = (
    workItemId: number,
    title: string,
    parentWorkItemId: number | null
  ): TimelineReadModel["bars"][number] => ({
    ...base.bars[0]!,
    workItemId,
    title,
    details: {
      mappedId: String(workItemId),
      parentWorkItemId,
      workItemType: workItemId === 1 ? "Feature" : "User Story"
    }
  });

  return {
    ...base,
    queryType: "tree",
    bars: [
      makeBar(1, "Parent", null),
      makeBar(2, "Existing child", 1),
      makeBar(4, "Existing grandchild", 2),
      makeBar(3, "Outside", null)
    ],
    unschedulable: [],
    treeLayout: {
      "1": {
        depth: 0,
        parentWorkItemId: null,
        hasChildren: true,
        isLastSibling: false,
        ancestorIsLastSibling: []
      },
      "2": {
        depth: 1,
        parentWorkItemId: 1,
        hasChildren: true,
        isLastSibling: true,
        ancestorIsLastSibling: [false]
      },
      "4": {
        depth: 2,
        parentWorkItemId: 2,
        hasChildren: false,
        isLastSibling: true,
        ancestorIsLastSibling: [false, true]
      },
      "3": {
        depth: 0,
        parentWorkItemId: null,
        hasChildren: false,
        isLastSibling: true,
        ancestorIsLastSibling: []
      }
    }
  };
}

describe("ui-client-timeline-mutations", () => {
  it("applies schedule updates to bars", () => {
    const updated = applyScheduleUpdate(makeTimeline(), 11, "2026-04-01T00:00:00.000Z", "2026-04-05T00:00:00.000Z");
    expect(updated?.bars[0]?.schedule.startDate).toBe("2026-04-01T00:00:00.000Z");
    expect(updated?.bars[0]?.schedule.endDate).toBe("2026-04-05T00:00:00.000Z");
  });

  it("applies metadata updates to bars and unschedulable items", () => {
    const updated = applyWorkItemMetadataUpdate(makeTimeline(), 22, "New title", "<p>updated</p>", "Done", "#abcdef");
    expect(updated?.unschedulable[0]?.title).toBe("New title");
    expect(updated?.unschedulable[0]?.details.descriptionHtml).toBe("<p>updated</p>");
    expect(updated?.unschedulable[0]?.state.code).toBe("Done");
    expect(updated?.unschedulable[0]?.state.color).toBe("#abcdef");
  });

  it("applies state-only updates without changing title or description", () => {
    const updated = applyWorkItemStateUpdate(makeTimeline(), 11, "Closed", "abcdef");
    expect(updated?.bars[0]?.title).toBe("Item 11");
    expect(updated?.bars[0]?.details.descriptionHtml).toBe("<p>a</p>");
    expect(updated?.bars[0]?.state.code).toBe("Closed");
    expect(updated?.bars[0]?.state.color).toBe("#abcdef");
  });

  it("adds and removes dependency links idempotently", () => {
    const added = applyDependencyLinkUpdate(makeTimeline(), 11, 22, "add");
    const addedAgain = applyDependencyLinkUpdate(added, 11, 22, "add");
    expect(addedAgain?.dependencies).toHaveLength(1);

    const removed = applyDependencyLinkUpdate(addedAgain, 11, 22, "remove");
    expect(removed?.dependencies).toHaveLength(0);
  });

  it("adds a created duplicate next to its source without copying dependency links", () => {
    const timeline = {
      ...makeTimeline(),
      dependencies: [
        {
          predecessorWorkItemId: 11,
          successorWorkItemId: 22,
          dependencyType: "FS",
          label: "#11 [end] -> #22 [start]"
        }
      ]
    } satisfies TimelineReadModel;

    const updated = applyDuplicateWorkItemUpdate(timeline, 11, {
      id: 99,
      state: "New",
      fieldValues: {
        "System.Title": "Item 11",
        "System.State": "New",
        "Custom.Team": "Delivery"
      },
      schedule: {
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-03T00:00:00.000Z"
      }
    });

    expect(updated?.bars.map((bar) => bar.workItemId)).toEqual([11, 99]);
    expect(updated?.bars[1]).toMatchObject({
      workItemId: 99,
      title: "Item 11 (copy)",
      state: {
        code: "New"
      },
      details: {
        mappedId: "99",
        fieldValues: {
          "System.Title": "Item 11 (copy)",
          "Custom.Team": "Delivery"
        }
      }
    });
    expect(updated?.dependencies).toEqual(timeline.dependencies);
  });

  it("uses source timeline data when Azure only returns the created work item id", () => {
    const updated = applyDuplicateWorkItemUpdate(makeTimeline(), 22, { id: 99 });

    expect(updated?.unschedulable.map((item) => item.workItemId)).toEqual([22, 99]);
    expect(updated?.unschedulable[1]).toMatchObject({
      workItemId: 99,
      title: "Item 22 (copy)",
      details: {
        mappedId: "99",
        descriptionHtml: "<p>b</p>"
      }
    });
  });

  it("adds the created duplicate to the active response work item ids", () => {
    const response = {
      workItemIds: [11, 22],
      timeline: makeTimeline()
    } as QueryIntakeResponse;

    const updated = applyDuplicateWorkItemToResponse(response, 11, { id: 99 });

    expect(updated?.workItemIds).toEqual([11, 22, 99]);
    expect(updated?.timeline?.bars.map((bar) => bar.workItemId)).toEqual([11, 99]);
  });

  it("adds a scheduled created child after the existing descendant block and rebuilds tree layout", () => {
    const updated = applyCreatedChildWorkItemUpdate(makeTreeTimeline(), 1, {
      id: 99,
      title: "Created story",
      state: "New",
      workItemType: "User Story",
      fieldValues: {
        "System.Title": "Created story",
        "System.WorkItemType": "User Story"
      },
      schedule: {
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-03T00:00:00.000Z"
      }
    });

    expect(updated?.bars.map((bar) => bar.workItemId)).toEqual([1, 2, 4, 99, 3]);
    expect(updated?.bars[3]).toMatchObject({
      workItemId: 99,
      title: "Created story",
      schedule: {
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-03T00:00:00.000Z",
        missingBoundary: null
      },
      details: {
        parentWorkItemId: 1,
        workItemType: "User Story",
        fieldValues: {
          "System.Title": "Created story"
        }
      }
    });
    expect(updated?.treeLayout?.["99"]).toMatchObject({
      depth: 1,
      parentWorkItemId: 1
    });
  });

  it("adds a start-only created child as a bar with a missing end boundary", () => {
    const updated = applyCreatedChildWorkItemUpdate(makeTreeTimeline(), 1, {
      id: 99,
      title: "Started story",
      schedule: {
        startDate: "2026-04-01T00:00:00.000Z"
      }
    });

    expect(updated?.bars.map((bar) => bar.workItemId)).toEqual([1, 2, 4, 99, 3]);
    expect(updated?.bars[3]?.schedule).toEqual({
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: null,
      missingBoundary: "end"
    });
    expect(updated?.unschedulable).toHaveLength(0);
  });

  it("adds an end-only created child as a bar with a missing start boundary", () => {
    const updated = applyCreatedChildWorkItemUpdate(makeTreeTimeline(), 1, {
      id: 99,
      title: "Finishing story",
      schedule: {
        endDate: "2026-04-03T00:00:00.000Z"
      }
    });

    expect(updated?.bars.map((bar) => bar.workItemId)).toEqual([1, 2, 4, 99, 3]);
    expect(updated?.bars[3]?.schedule).toEqual({
      startDate: null,
      endDate: "2026-04-03T00:00:00.000Z",
      missingBoundary: "start"
    });
    expect(updated?.unschedulable).toHaveLength(0);
  });

  it("adds an unscheduled created child after existing unscheduled descendants", () => {
    const base = makeTimeline();
    const timeline = {
      ...base,
      bars: [
        {
          ...base.bars[0]!,
          workItemId: 1,
          title: "Parent",
          details: { mappedId: "1", workItemType: "Feature" }
        }
      ],
      unschedulable: [
        {
          ...base.unschedulable[0]!,
          workItemId: 2,
          title: "Existing child",
          details: { mappedId: "2", parentWorkItemId: 1 }
        },
        {
          ...base.unschedulable[0]!,
          workItemId: 5,
          title: "Existing grandchild",
          details: { mappedId: "5", parentWorkItemId: 2 }
        },
        {
          ...base.unschedulable[0]!,
          workItemId: 8,
          title: "Outside",
          details: { mappedId: "8" }
        }
      ]
    } satisfies TimelineReadModel;

    const updated = applyCreatedChildWorkItemUpdate(timeline, 1, {
      id: 99,
      title: "Created task",
      workItemType: "Task"
    });

    expect(updated?.unschedulable.map((item) => item.workItemId)).toEqual([2, 5, 99, 8]);
    expect(updated?.unschedulable[2]).toMatchObject({
      workItemId: 99,
      title: "Created task",
      details: {
        parentWorkItemId: 1,
        workItemType: "Task"
      },
      reason: "missing-both-dates"
    });
  });

  it("adds created children to the active response work item ids", () => {
    const response = {
      workItemIds: [1, 2, 3, 4],
      timeline: makeTreeTimeline()
    } as QueryIntakeResponse;

    const updated = applyCreatedChildWorkItemToResponse(response, 1, {
      id: 99,
      schedule: {
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-03T00:00:00.000Z"
      }
    });

    expect(updated?.workItemIds).toEqual([1, 2, 3, 4, 99]);
    expect(updated?.timeline?.bars.map((bar) => bar.workItemId)).toEqual([1, 2, 4, 99, 3]);
  });

  it("returns the unchanged timeline when the parent is not visible", () => {
    const timeline = makeTimeline();

    const updated = applyCreatedChildWorkItemUpdate(timeline, 404, {
      id: 99,
      title: "Created child"
    });

    expect(updated).toBe(timeline);
  });
});
