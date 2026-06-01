// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TimelineReadModel, TimelineTreeNodeMeta } from "../../application/dto/timeline-read-model.js";
import { applyTreeVisibility, useTreeExpandCollapse } from "./use-tree-expand-collapse.js";

describe("useTreeExpandCollapse", () => {
  it("toggles collapsible items at a level within the filtered scope only", () => {
    const treeLayout = makeTreeLayout();
    const scopedIds = new Set([1, 2, 3]);
    const { result } = renderHook(() => useTreeExpandCollapse(treeLayout, scopedIds));

    act(() => {
      result.current.toggleLevel(1);
    });

    expect(toSortedIds(result.current.collapsedIds)).toEqual([2]);

    act(() => {
      result.current.toggleLevel(1);
    });

    expect(toSortedIds(result.current.collapsedIds)).toEqual([]);
  });

  it("toggles a level by collapsing mixed or expanded levels and expanding fully collapsed levels", () => {
    const treeLayout = makeTreeLayout();
    const scopedIds = new Set([1, 2, 3, 4, 5]);
    const { result } = renderHook(() => useTreeExpandCollapse(treeLayout, scopedIds));

    act(() => {
      result.current.toggleLevel(1);
    });

    expect(toSortedIds(result.current.collapsedIds)).toEqual([2, 4]);

    act(() => {
      result.current.toggle(2);
    });

    expect(toSortedIds(result.current.collapsedIds)).toEqual([4]);

    act(() => {
      result.current.toggleLevel(1);
    });

    expect(toSortedIds(result.current.collapsedIds)).toEqual([2, 4]);

    act(() => {
      result.current.toggleLevel(1);
    });

    expect(toSortedIds(result.current.collapsedIds)).toEqual([]);
  });

  it("keeps row toggles functional with tree visibility", () => {
    const timeline = makeTimeline();
    const { result } = renderHook(() =>
      useTreeExpandCollapse(timeline.treeLayout, new Set(timeline.bars.map((bar) => bar.workItemId)))
    );

    act(() => {
      result.current.toggle(1);
    });

    expect(result.current.isCollapsed(1)).toBe(true);
    expect(applyTreeVisibility(timeline, result.current.collapsedIds)?.bars.map((bar) => bar.workItemId)).toEqual([1]);

    act(() => {
      result.current.toggle(1);
    });

    expect(result.current.isCollapsed(1)).toBe(false);
    expect(applyTreeVisibility(timeline, result.current.collapsedIds)?.bars.map((bar) => bar.workItemId)).toEqual([
      1,
      2,
      3
    ]);
  });

  it("keeps filtered descendants visible when collapsed ancestors are outside the filtered scope", () => {
    const timeline = {
      ...makeTimeline(),
      bars: [makeBar(3)]
    };

    expect(applyTreeVisibility(timeline, new Set([1, 2]))?.bars.map((bar) => bar.workItemId)).toEqual([3]);
  });

  it("hides filtered descendants when a collapsed ancestor is inside the filtered scope", () => {
    const timeline = {
      ...makeTimeline(),
      bars: [makeBar(2), makeBar(3)]
    };

    expect(applyTreeVisibility(timeline, new Set([2]))?.bars.map((bar) => bar.workItemId)).toEqual([2]);
  });
});

function makeTimeline(): TimelineReadModel {
  return {
    queryType: "tree",
    bars: [makeBar(1), makeBar(2), makeBar(3)],
    unschedulable: [],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: {
      "1": makeTreeMeta(0, null, true),
      "2": makeTreeMeta(1, 1, true),
      "3": makeTreeMeta(2, 2, false)
    },
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

function makeTreeLayout(): Record<string, TimelineTreeNodeMeta> {
  return {
    "1": makeTreeMeta(0, null, true),
    "2": makeTreeMeta(1, 1, true),
    "3": makeTreeMeta(2, 2, false),
    "4": makeTreeMeta(1, 1, true),
    "5": makeTreeMeta(2, 4, false),
    "99": makeTreeMeta(1, null, true)
  };
}

function makeBar(workItemId: number): TimelineReadModel["bars"][number] {
  return {
    workItemId,
    title: `Item ${workItemId}`,
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

function toSortedIds(ids: ReadonlySet<number>): number[] {
  return Array.from(ids).sort((left, right) => left - right);
}
