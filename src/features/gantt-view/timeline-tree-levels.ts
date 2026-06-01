import type { TimelineReadModel, TimelineTreeNodeMeta } from "../../application/dto/timeline-read-model.js";

export type TimelineTreeLevelState = "expanded" | "collapsed" | "mixed" | "leaf-only";

export type TimelineTreeLevelSummary = {
  depth: number;
  itemCount: number;
  collapsibleCount: number;
  collapsedCount: number;
  disabled: boolean;
  state: TimelineTreeLevelState;
};

export function listTimelineTreeWorkItemIds(timeline: TimelineReadModel | null): ReadonlySet<number> {
  if (!timeline) {
    return new Set();
  }

  return new Set([
    ...timeline.bars.map((bar) => bar.workItemId),
    ...timeline.unschedulable.map((item) => item.workItemId)
  ]);
}

export function summarizeTimelineTreeLevels(
  timeline: TimelineReadModel | null,
  collapsedIds: ReadonlySet<number>
): TimelineTreeLevelSummary[] {
  if (!timeline?.treeLayout) {
    return [];
  }

  const visibleWorkItemIds = listTimelineTreeWorkItemIds(timeline);
  const countsByDepth = new Map<number, { itemCount: number; collapsibleCount: number; collapsedCount: number }>();
  let maxDepth = -1;

  for (const workItemId of visibleWorkItemIds) {
    const meta = timeline.treeLayout[workItemId];
    if (!meta) {
      continue;
    }

    const current = countsByDepth.get(meta.depth) ?? { itemCount: 0, collapsibleCount: 0, collapsedCount: 0 };
    current.itemCount += 1;
    if (meta.hasChildren) {
      current.collapsibleCount += 1;
      if (collapsedIds.has(workItemId)) {
        current.collapsedCount += 1;
      }
    }
    countsByDepth.set(meta.depth, current);
    maxDepth = Math.max(maxDepth, meta.depth);
  }

  if (maxDepth < 0) {
    return [];
  }

  return Array.from({ length: maxDepth + 1 }, (_, depth) => {
    const counts = countsByDepth.get(depth) ?? { itemCount: 0, collapsibleCount: 0, collapsedCount: 0 };
    const disabled = counts.collapsibleCount === 0;

    return {
      depth,
      itemCount: counts.itemCount,
      collapsibleCount: counts.collapsibleCount,
      collapsedCount: counts.collapsedCount,
      disabled,
      state: resolveTimelineTreeLevelState(counts.collapsibleCount, counts.collapsedCount)
    };
  });
}

export function listCollapsibleTreeIds(
  treeLayout: Record<string, TimelineTreeNodeMeta> | null,
  includedWorkItemIds: ReadonlySet<number> | null,
  depth?: number
): number[] {
  if (!treeLayout) {
    return [];
  }

  return Object.keys(treeLayout)
    .map((id) => Number(id))
    .filter((workItemId) => {
      if (!Number.isFinite(workItemId)) {
        return false;
      }

      if (includedWorkItemIds && !includedWorkItemIds.has(workItemId)) {
        return false;
      }

      const meta = treeLayout[workItemId];
      return Boolean(meta?.hasChildren) && (typeof depth === "undefined" || meta.depth === depth);
    });
}

function resolveTimelineTreeLevelState(collapsibleCount: number, collapsedCount: number): TimelineTreeLevelState {
  if (collapsibleCount === 0) {
    return "leaf-only";
  }

  if (collapsedCount === 0) {
    return "expanded";
  }

  return collapsedCount === collapsibleCount ? "collapsed" : "mixed";
}
