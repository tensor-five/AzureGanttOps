import { describe, expect, it } from "vitest";

import type { TimelineReadModel, TimelineTreeNodeMeta } from "../../application/dto/timeline-read-model.js";
import { listCollapsibleTreeIds, summarizeTimelineTreeLevels } from "./timeline-tree-levels.js";

function makeTreeTimeline(): TimelineReadModel {
  return {
    queryType: "tree",
    bars: [
      makeBar(1, "Root"),
      makeBar(2, "Child parent"),
      makeBar(3, "Grandchild"),
      makeBar(4, "Child leaf")
    ],
    unschedulable: [
      {
        workItemId: 5,
        title: "Unscheduled grandchild",
        state: { code: "New", badge: "N", color: "#2563eb" },
        details: { mappedId: "5" },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: {
      "1": makeTreeMeta(0, null, true),
      "2": makeTreeMeta(1, 1, true),
      "3": makeTreeMeta(2, 2, false),
      "4": makeTreeMeta(1, 1, false),
      "5": makeTreeMeta(2, 2, false),
      "99": makeTreeMeta(3, null, true)
    },
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

describe("timeline tree levels", () => {
  it("counts levels from filtered bars and unschedulable items only", () => {
    const summaries = summarizeTimelineTreeLevels(makeTreeTimeline(), new Set());

    expect(summaries.map((summary) => ({
      depth: summary.depth,
      itemCount: summary.itemCount,
      collapsibleCount: summary.collapsibleCount
    }))).toEqual([
      { depth: 0, itemCount: 1, collapsibleCount: 1 },
      { depth: 1, itemCount: 2, collapsibleCount: 1 },
      { depth: 2, itemCount: 2, collapsibleCount: 0 }
    ]);
  });

  it("omits missing depths and unrelated tree layout levels from the filtered query scope", () => {
    const timeline = makeTreeTimeline();
    timeline.bars = [makeBar(1, "Root")];
    timeline.unschedulable = [
      {
        workItemId: 5,
        title: "Filtered grandchild",
        state: { code: "New", badge: "N", color: "#2563eb" },
        details: { mappedId: "5" },
        reason: "missing-both-dates"
      }
    ];

    const summaries = summarizeTimelineTreeLevels(timeline, new Set());

    expect(summaries.map((summary) => ({
      depth: summary.depth,
      itemCount: summary.itemCount,
      state: summary.state
    }))).toEqual([
      { depth: 0, itemCount: 1, state: "expanded" },
      { depth: 2, itemCount: 1, state: "leaf-only" }
    ]);
  });

  it("reports expanded, collapsed, and mixed level states from collapsed ids", () => {
    const timeline = makeTreeTimeline();
    timeline.bars = [
      makeBar(1, "Root"),
      makeBar(2, "Child parent"),
      makeBar(3, "Grandchild A"),
      makeBar(4, "Second child parent"),
      makeBar(6, "Grandchild B")
    ];
    timeline.unschedulable = [];
    timeline.treeLayout = {
      "1": makeTreeMeta(0, null, true),
      "2": makeTreeMeta(1, 1, true),
      "3": makeTreeMeta(2, 2, false),
      "4": makeTreeMeta(1, 1, true),
      "6": makeTreeMeta(2, 4, false)
    };

    expect(summarizeTimelineTreeLevels(timeline, new Set())[1]?.state).toBe("expanded");
    expect(summarizeTimelineTreeLevels(timeline, new Set([2]))[1]?.state).toBe("mixed");
    expect(summarizeTimelineTreeLevels(timeline, new Set([2, 4]))[1]?.state).toBe("collapsed");
  });

  it("marks leaf-only levels as disabled", () => {
    const leafOnlyLevel = summarizeTimelineTreeLevels(makeTreeTimeline(), new Set())[2];

    expect(leafOnlyLevel).toMatchObject({
      depth: 2,
      disabled: true,
      state: "leaf-only",
      collapsibleCount: 0
    });
  });

  it("lists collapsible ids within the filtered timeline scope", () => {
    const timeline = makeTreeTimeline();
    const scopedIds = new Set([
      ...timeline.bars.map((bar) => bar.workItemId),
      ...timeline.unschedulable.map((item) => item.workItemId)
    ]);

    expect(listCollapsibleTreeIds(timeline.treeLayout, scopedIds, 0)).toEqual([1]);
    expect(listCollapsibleTreeIds(timeline.treeLayout, scopedIds, 1)).toEqual([2]);
    expect(listCollapsibleTreeIds(timeline.treeLayout, scopedIds, 3)).toEqual([]);
  });
});

function makeBar(workItemId: number, title: string): TimelineReadModel["bars"][number] {
  return {
    workItemId,
    title,
    state: { code: "Active", badge: "A", color: "#2f855a" },
    schedule: {
      startDate: "2026-03-01T00:00:00.000Z",
      endDate: "2026-03-03T00:00:00.000Z",
      missingBoundary: null
    },
    details: { mappedId: String(workItemId) }
  };
}

function makeTreeMeta(
  depth: number,
  parentWorkItemId: number | null,
  hasChildren: boolean
): TimelineTreeNodeMeta {
  return {
    depth,
    parentWorkItemId,
    hasChildren,
    isLastSibling: false,
    ancestorIsLastSibling: []
  };
}
