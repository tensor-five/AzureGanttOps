import * as React from "react";
import type { TimelineTreeNodeMeta, TimelineReadModel } from "../../application/dto/timeline-read-model.js";

export type TreeExpandCollapseState = {
  collapsedIds: ReadonlySet<number>;
  toggle: (workItemId: number) => void;
  collapseAll: () => void;
  expandAll: () => void;
  isCollapsed: (workItemId: number) => boolean;
};

export function useTreeExpandCollapse(
  treeLayout: Record<string, TimelineTreeNodeMeta> | null
): TreeExpandCollapseState {
  const [collapsedIds, setCollapsedIds] = React.useState<ReadonlySet<number>>(new Set());

  const toggle = React.useCallback((workItemId: number) => {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (next.has(workItemId)) {
        next.delete(workItemId);
      } else {
        next.add(workItemId);
      }
      return next;
    });
  }, []);

  const collapseAll = React.useCallback(() => {
    if (!treeLayout) {
      return;
    }

    const allParents = new Set<number>();
    for (const id of Object.keys(treeLayout)) {
      const meta = treeLayout[id];
      if (meta.hasChildren) {
        allParents.add(Number(id));
      }
    }

    setCollapsedIds(allParents);
  }, [treeLayout]);

  const expandAll = React.useCallback(() => {
    setCollapsedIds(new Set());
  }, []);

  const isCollapsed = React.useCallback(
    (workItemId: number) => collapsedIds.has(workItemId),
    [collapsedIds]
  );

  return {
    collapsedIds,
    toggle,
    collapseAll,
    expandAll,
    isCollapsed
  };
}

export function applyTreeVisibility(
  timeline: TimelineReadModel | null,
  collapsedIds: ReadonlySet<number>
): TimelineReadModel | null {
  if (!timeline || !timeline.treeLayout || collapsedIds.size === 0) {
    return timeline;
  }

  const treeLayout = timeline.treeLayout;

  const isHidden = (workItemId: number): boolean => {
    const meta = treeLayout[workItemId];
    if (!meta) {
      return false;
    }

    let parentId = meta.parentWorkItemId;
    while (parentId !== null) {
      if (collapsedIds.has(parentId)) {
        return true;
      }

      const parentMeta = treeLayout[parentId];
      if (!parentMeta) {
        break;
      }

      parentId = parentMeta.parentWorkItemId;
    }

    return false;
  };

  const bars = timeline.bars.filter((bar) => !isHidden(bar.workItemId));
  const unschedulable = timeline.unschedulable.filter((item) => !isHidden(item.workItemId));

  return {
    ...timeline,
    bars,
    unschedulable
  };
}
