import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { applyDependencyLinkUpdate, applyScheduleUpdate, applyWorkItemMetadataUpdate } from "./ui-client-timeline-mutations.js";

function makeTimeline(): TimelineReadModel {
  return {
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

  it("adds and removes dependency links idempotently", () => {
    const added = applyDependencyLinkUpdate(makeTimeline(), 11, 22, "add");
    const addedAgain = applyDependencyLinkUpdate(added, 11, 22, "add");
    expect(addedAgain?.dependencies).toHaveLength(1);

    const removed = applyDependencyLinkUpdate(addedAgain, 11, 22, "remove");
    expect(removed?.dependencies).toHaveLength(0);
  });
});
