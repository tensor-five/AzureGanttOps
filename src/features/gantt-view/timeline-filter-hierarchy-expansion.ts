import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

export type TimelineFilterHierarchyExpansionOptions = {
  includeParents: boolean;
  includeChildItems: boolean;
};

export const DEFAULT_TIMELINE_FILTER_HIERARCHY_EXPANSION_OPTIONS: TimelineFilterHierarchyExpansionOptions = {
  includeParents: false,
  includeChildItems: false
};

export function normalizeTimelineFilterHierarchyExpansionOptions(
  options: Partial<TimelineFilterHierarchyExpansionOptions> | null | undefined
): TimelineFilterHierarchyExpansionOptions {
  return {
    includeParents: options?.includeParents === true,
    includeChildItems: options?.includeChildItems === true
  };
}

export function applyTimelineFilterHierarchyExpansion(input: {
  sourceTimeline: TimelineReadModel | null;
  seedTimeline: TimelineReadModel | null;
  options: TimelineFilterHierarchyExpansionOptions;
}): TimelineReadModel | null {
  const { sourceTimeline, seedTimeline } = input;
  const options = normalizeTimelineFilterHierarchyExpansionOptions(input.options);

  if (!sourceTimeline || !seedTimeline || sourceTimeline.treeLayout === null) {
    return seedTimeline;
  }

  if (!options.includeParents && !options.includeChildItems) {
    return seedTimeline;
  }

  const sourceWorkItemIds = listTimelineWorkItemIds(sourceTimeline);
  const seedWorkItemIds = listTimelineWorkItemIds(seedTimeline);
  const finalWorkItemIds = new Set(seedWorkItemIds);

  if (options.includeParents) {
    addParentWorkItemIds({
      treeLayout: sourceTimeline.treeLayout,
      sourceWorkItemIds,
      seedWorkItemIds,
      targetWorkItemIds: finalWorkItemIds
    });
  }

  if (options.includeChildItems) {
    addDescendantWorkItemIds({
      treeLayout: sourceTimeline.treeLayout,
      sourceWorkItemIds,
      seedWorkItemIds,
      targetWorkItemIds: finalWorkItemIds
    });
  }

  return {
    ...sourceTimeline,
    bars: sourceTimeline.bars.filter((bar) => finalWorkItemIds.has(bar.workItemId)),
    unschedulable: sourceTimeline.unschedulable.filter((item) => finalWorkItemIds.has(item.workItemId)),
    dependencies: sourceTimeline.dependencies.filter(
      (dependency) =>
        finalWorkItemIds.has(dependency.predecessorWorkItemId) &&
        finalWorkItemIds.has(dependency.successorWorkItemId)
    ),
    suppressedDependencies: sourceTimeline.suppressedDependencies.filter(
      (dependency) =>
        finalWorkItemIds.has(dependency.predecessorWorkItemId) &&
        finalWorkItemIds.has(dependency.successorWorkItemId)
    )
  };
}

function listTimelineWorkItemIds(timeline: TimelineReadModel): ReadonlySet<number> {
  return new Set([
    ...timeline.bars.map((bar) => bar.workItemId),
    ...timeline.unschedulable.map((item) => item.workItemId)
  ]);
}

function addParentWorkItemIds(input: {
  treeLayout: NonNullable<TimelineReadModel["treeLayout"]>;
  sourceWorkItemIds: ReadonlySet<number>;
  seedWorkItemIds: ReadonlySet<number>;
  targetWorkItemIds: Set<number>;
}): void {
  input.seedWorkItemIds.forEach((seedWorkItemId) => {
    let parentWorkItemId = input.treeLayout[seedWorkItemId]?.parentWorkItemId ?? null;
    const visitedParentIds = new Set<number>();

    while (parentWorkItemId !== null) {
      if (visitedParentIds.has(parentWorkItemId)) {
        break;
      }
      visitedParentIds.add(parentWorkItemId);

      if (input.sourceWorkItemIds.has(parentWorkItemId)) {
        input.targetWorkItemIds.add(parentWorkItemId);
      }

      const parentMeta = input.treeLayout[parentWorkItemId];
      if (!parentMeta) {
        break;
      }

      parentWorkItemId = parentMeta.parentWorkItemId;
    }
  });
}

function addDescendantWorkItemIds(input: {
  treeLayout: NonNullable<TimelineReadModel["treeLayout"]>;
  sourceWorkItemIds: ReadonlySet<number>;
  seedWorkItemIds: ReadonlySet<number>;
  targetWorkItemIds: Set<number>;
}): void {
  const childrenByParentId = new Map<number, number[]>();
  Object.entries(input.treeLayout).forEach(([workItemIdRaw, meta]) => {
    const workItemId = Number(workItemIdRaw);
    if (!Number.isFinite(workItemId)) {
      return;
    }

    const parentWorkItemId = meta.parentWorkItemId;
    if (parentWorkItemId !== null) {
      const children = childrenByParentId.get(parentWorkItemId) ?? [];
      children.push(workItemId);
      childrenByParentId.set(parentWorkItemId, children);
    }
  });

  input.seedWorkItemIds.forEach((seedWorkItemId) => {
    const pending = [...(childrenByParentId.get(seedWorkItemId) ?? [])];
    const visitedChildIds = new Set<number>();

    while (pending.length > 0) {
      const workItemId = pending.shift();
      if (typeof workItemId !== "number" || visitedChildIds.has(workItemId)) {
        continue;
      }

      visitedChildIds.add(workItemId);
      if (input.sourceWorkItemIds.has(workItemId)) {
        input.targetWorkItemIds.add(workItemId);
      }
      pending.push(...(childrenByParentId.get(workItemId) ?? []));
    }
  });
}
