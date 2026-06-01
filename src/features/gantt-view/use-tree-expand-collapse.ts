import * as React from "react";
import type { TimelineTreeNodeMeta, TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { listCollapsibleTreeIds, listTimelineTreeWorkItemIds } from "./timeline-tree-levels.js";

export type TreeExpandCollapseState = {
  collapsedIds: ReadonlySet<number>;
  toggle: (workItemId: number) => void;
  toggleLevel: (depth: number) => void;
  collapseAll: () => void;
  expandAll: () => void;
  isCollapsed: (workItemId: number) => boolean;
};

export function useTreeExpandCollapse(
  treeLayout: Record<string, TimelineTreeNodeMeta> | null,
  includedWorkItemIds: ReadonlySet<number> | null = null
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

    setCollapsedIds(new Set(listCollapsibleTreeIds(treeLayout, includedWorkItemIds)));
  }, [includedWorkItemIds, treeLayout]);

  const toggleLevel = React.useCallback((depth: number) => {
    const levelIds = listCollapsibleTreeIds(treeLayout, includedWorkItemIds, depth);
    if (levelIds.length === 0) {
      return;
    }

    setCollapsedIds((previous) => {
      const allCollapsed = levelIds.every((id) => previous.has(id));
      const next = new Set(previous);
      for (const id of levelIds) {
        if (allCollapsed) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }

      return next;
    });
  }, [includedWorkItemIds, treeLayout]);

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
    toggleLevel,
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
  const visibleWorkItemIds = listTimelineTreeWorkItemIds(timeline);

  const isHidden = (workItemId: number): boolean => {
    const meta = treeLayout[workItemId];
    if (!meta) {
      return false;
    }

    let parentId = meta.parentWorkItemId;
    while (parentId !== null) {
      if (visibleWorkItemIds.has(parentId) && collapsedIds.has(parentId)) {
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
