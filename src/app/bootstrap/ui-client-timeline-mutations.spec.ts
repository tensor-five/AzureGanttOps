import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import {
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
});
