import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { applyTimelineFilterHierarchyExpansion } from "./timeline-filter-hierarchy-expansion.js";

describe("timeline-filter-hierarchy-expansion", () => {
  it("includes parents recursively up to the query root", () => {
    const sourceTimeline = makeHierarchyTimeline();
    const seedTimeline = pickTimelineItems(sourceTimeline, [3]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: true, includeChildItems: false }
    });

    expect(listBarIds(expanded)).toEqual([1, 2, 3]);
    expect(listUnschedulableIds(expanded)).toEqual([]);
  });

  it("includes only direct child items without recursive descendants", () => {
    const sourceTimeline = makeHierarchyTimeline();
    const seedTimeline = pickTimelineItems(sourceTimeline, [3]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: false, includeChildItems: true }
    });

    expect(listBarIds(expanded)).toEqual([3, 4]);
    expect(listUnschedulableIds(expanded)).toEqual([7]);
  });

  it("ignores missing parents outside the current query", () => {
    const sourceTimeline = makeHierarchyTimeline();
    const seedTimeline = pickTimelineItems(sourceTimeline, [6]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: true, includeChildItems: false }
    });

    expect(listBarIds(expanded)).toEqual([6]);
    expect(listUnschedulableIds(expanded)).toEqual([]);
  });

  it("traverses missing intermediate parents without adding them", () => {
    const baseTimeline = makeHierarchyTimeline();
    const sourceTimeline = {
      ...baseTimeline,
      bars: baseTimeline.bars.filter((bar) => bar.workItemId !== 2)
    };
    const seedTimeline = pickTimelineItems(sourceTimeline, [3]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: true, includeChildItems: false }
    });

    expect(listBarIds(expanded)).toEqual([1, 3]);
    expect(listUnschedulableIds(expanded)).toEqual([]);
  });

  it("expands bars and unschedulable seed items through the same tree layout", () => {
    const sourceTimeline = makeHierarchyTimeline();
    const seedTimeline = pickTimelineItems(sourceTimeline, [7]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: true, includeChildItems: false }
    });

    expect(listBarIds(expanded)).toEqual([1, 2, 3]);
    expect(listUnschedulableIds(expanded)).toEqual([7]);
  });

  it("keeps source order and de-duplicates items when parent and child expansion overlap", () => {
    const sourceTimeline = makeHierarchyTimeline();
    const seedTimeline = pickTimelineItems(sourceTimeline, [3, 4]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: true, includeChildItems: true }
    });
    const barIds = listBarIds(expanded);
    const unschedulableIds = listUnschedulableIds(expanded);

    expect(barIds).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(barIds).size).toBe(barIds.length);
    expect(unschedulableIds).toEqual([7]);
  });

  it("reduces dependencies and suppressed dependencies from the source timeline by final visible ids", () => {
    const sourceTimeline = makeHierarchyTimeline();
    const seedTimeline = pickTimelineItems(sourceTimeline, [3]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: false, includeChildItems: true }
    });

    expect(expanded?.dependencies).toEqual([
      {
        predecessorWorkItemId: 3,
        successorWorkItemId: 4,
        dependencyType: "FS",
        label: "#3 [end] -> #4 [start]"
      }
    ]);
    expect(expanded?.suppressedDependencies).toEqual([
      {
        predecessorWorkItemId: 3,
        successorWorkItemId: 7,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      }
    ]);
  });

  it("is a no-op for flat timelines without a tree layout", () => {
    const sourceTimeline = {
      ...makeHierarchyTimeline(),
      queryType: "flat" as const,
      treeLayout: null
    };
    const seedTimeline = pickTimelineItems(sourceTimeline, [3]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: true, includeChildItems: true }
    });

    expect(expanded).toBe(seedTimeline);
  });

  it("returns the seed timeline when the source timeline is null", () => {
    const seedTimeline = pickTimelineItems(makeHierarchyTimeline(), [3]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline: null,
      seedTimeline,
      options: { includeParents: true, includeChildItems: true }
    });

    expect(expanded).toBe(seedTimeline);
  });

  it("returns null when the seed timeline is null", () => {
    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline: makeHierarchyTimeline(),
      seedTimeline: null,
      options: { includeParents: true, includeChildItems: true }
    });

    expect(expanded).toBeNull();
  });

  it("returns the seed timeline when both hierarchy expansion flags are false", () => {
    const sourceTimeline = makeHierarchyTimeline();
    const seedTimeline = pickTimelineItems(sourceTimeline, [3]);

    const expanded = applyTimelineFilterHierarchyExpansion({
      sourceTimeline,
      seedTimeline,
      options: { includeParents: false, includeChildItems: false }
    });

    expect(expanded).toBe(seedTimeline);
  });
});

function makeHierarchyTimeline(): TimelineReadModel {
  return {
    queryType: "tree",
    bars: [
      makeBar(1, "Root", "Root"),
      makeBar(2, "Parent", "Parent"),
      makeBar(3, "Seed", "Alpha"),
      makeBar(4, "Child", "Child"),
      makeBar(5, "Grandchild", "Grandchild"),
      makeBar(6, "Outside Parent Seed", "Outside")
    ],
    unschedulable: [
      {
        workItemId: 7,
        title: "Unsched Child",
        state: { code: "New", badge: "N", color: "#2563eb" },
        details: {
          mappedId: "7",
          fieldValues: { "Custom.Team": "Child" },
          parentWorkItemId: 3
        },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [
      {
        predecessorWorkItemId: 2,
        successorWorkItemId: 3,
        dependencyType: "FS",
        label: "#2 [end] -> #3 [start]"
      },
      {
        predecessorWorkItemId: 3,
        successorWorkItemId: 4,
        dependencyType: "FS",
        label: "#3 [end] -> #4 [start]"
      },
      {
        predecessorWorkItemId: 4,
        successorWorkItemId: 5,
        dependencyType: "FS",
        label: "#4 [end] -> #5 [start]"
      }
    ],
    suppressedDependencies: [
      {
        predecessorWorkItemId: 3,
        successorWorkItemId: 7,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      },
      {
        predecessorWorkItemId: 5,
        successorWorkItemId: 7,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      }
    ],
    treeLayout: {
      1: {
        depth: 0,
        parentWorkItemId: null,
        hasChildren: true,
        isLastSibling: true,
        ancestorIsLastSibling: []
      },
      2: {
        depth: 1,
        parentWorkItemId: 1,
        hasChildren: true,
        isLastSibling: true,
        ancestorIsLastSibling: [true]
      },
      3: {
        depth: 2,
        parentWorkItemId: 2,
        hasChildren: true,
        isLastSibling: false,
        ancestorIsLastSibling: [true, true]
      },
      4: {
        depth: 3,
        parentWorkItemId: 3,
        hasChildren: true,
        isLastSibling: false,
        ancestorIsLastSibling: [true, true, false]
      },
      5: {
        depth: 4,
        parentWorkItemId: 4,
        hasChildren: false,
        isLastSibling: true,
        ancestorIsLastSibling: [true, true, false, false]
      },
      6: {
        depth: 1,
        parentWorkItemId: 99,
        hasChildren: false,
        isLastSibling: true,
        ancestorIsLastSibling: [true]
      },
      7: {
        depth: 3,
        parentWorkItemId: 3,
        hasChildren: false,
        isLastSibling: true,
        ancestorIsLastSibling: [true, true, false]
      }
    },
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

function makeBar(workItemId: number, title: string, team: string): TimelineReadModel["bars"][number] {
  return {
    workItemId,
    title,
    state: { code: "Active", badge: "A", color: "#15803d" },
    schedule: {
      startDate: `2026-03-${String(workItemId).padStart(2, "0")}T00:00:00.000Z`,
      endDate: `2026-03-${String(workItemId + 1).padStart(2, "0")}T00:00:00.000Z`,
      missingBoundary: null
    },
    details: {
      mappedId: String(workItemId),
      fieldValues: { "Custom.Team": team },
      parentWorkItemId: workItemId === 1 ? null : workItemId - 1
    }
  };
}

function pickTimelineItems(sourceTimeline: TimelineReadModel, workItemIds: number[]): TimelineReadModel {
  const ids = new Set(workItemIds);
  return {
    ...sourceTimeline,
    bars: sourceTimeline.bars.filter((bar) => ids.has(bar.workItemId)),
    unschedulable: sourceTimeline.unschedulable.filter((item) => ids.has(item.workItemId)),
    dependencies: sourceTimeline.dependencies.filter(
      (dependency) => ids.has(dependency.predecessorWorkItemId) && ids.has(dependency.successorWorkItemId)
    ),
    suppressedDependencies: sourceTimeline.suppressedDependencies.filter(
      (dependency) => ids.has(dependency.predecessorWorkItemId) && ids.has(dependency.successorWorkItemId)
    )
  };
}

function listBarIds(timeline: TimelineReadModel | null): number[] {
  return timeline?.bars.map((bar) => bar.workItemId) ?? [];
}

function listUnschedulableIds(timeline: TimelineReadModel | null): number[] {
  return timeline?.unschedulable.map((item) => item.workItemId) ?? [];
}
