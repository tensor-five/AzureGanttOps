import * as React from "react";
import type { TimelineTreeNodeMeta } from "../../application/dto/timeline-read-model.js";

export type ReparentDragState = {
  sourceWorkItemId: number | null;
  dropTargetWorkItemId: number | null;
  isValid: boolean;
};

export type ReparentDragHandlers = {
  dragState: ReparentDragState;
  startDrag: (workItemId: number) => void;
  updateDropTarget: (workItemId: number | null) => void;
  executeDrop: () => { targetWorkItemId: number; newParentId: number | null } | null;
  clearDrag: () => void;
};

export function useReparentDragging(
  treeLayout: Record<string, TimelineTreeNodeMeta> | null
): ReparentDragHandlers {
  const [dragState, setDragState] = React.useState<ReparentDragState>({
    sourceWorkItemId: null,
    dropTargetWorkItemId: null,
    isValid: false
  });

  const treeLayoutRef = React.useRef(treeLayout);
  treeLayoutRef.current = treeLayout;

  const startDrag = React.useCallback((workItemId: number) => {
    setDragState({ sourceWorkItemId: workItemId, dropTargetWorkItemId: null, isValid: false });
  }, []);

  const updateDropTarget = React.useCallback((workItemId: number | null) => {
    setDragState((previous) => {
      if (!previous.sourceWorkItemId) {
        return previous;
      }

      if (workItemId === null) {
        return { ...previous, dropTargetWorkItemId: null, isValid: false };
      }

      if (workItemId === previous.sourceWorkItemId) {
        return { ...previous, dropTargetWorkItemId: workItemId, isValid: false };
      }

      const currentParent = treeLayoutRef.current?.[previous.sourceWorkItemId]?.parentWorkItemId ?? null;
      if (workItemId === currentParent) {
        return { ...previous, dropTargetWorkItemId: workItemId, isValid: false };
      }

      const wouldCreateCycle = isDescendantOf(workItemId, previous.sourceWorkItemId, treeLayoutRef.current);
      return {
        ...previous,
        dropTargetWorkItemId: workItemId,
        isValid: !wouldCreateCycle
      };
    });
  }, []);

  const executeDrop = React.useCallback((): { targetWorkItemId: number; newParentId: number | null } | null => {
    const current = dragState;
    if (!current.sourceWorkItemId || !current.isValid || current.dropTargetWorkItemId === null) {
      return null;
    }

    return {
      targetWorkItemId: current.sourceWorkItemId,
      newParentId: current.dropTargetWorkItemId
    };
  }, [dragState]);

  const clearDrag = React.useCallback(() => {
    setDragState({ sourceWorkItemId: null, dropTargetWorkItemId: null, isValid: false });
  }, []);

  return { dragState, startDrag, updateDropTarget, executeDrop, clearDrag };
}

export function isDescendantOf(
  candidateId: number,
  ancestorId: number,
  treeLayout: Record<string, TimelineTreeNodeMeta> | null
): boolean {
  if (!treeLayout) {
    return false;
  }

  let currentId: number | null = candidateId;
  const visited = new Set<number>();

  while (currentId !== null) {
    if (currentId === ancestorId) {
      return true;
    }

    if (visited.has(currentId)) {
      return false;
    }

    visited.add(currentId);
    const meta: TimelineTreeNodeMeta | undefined = treeLayout[currentId];
    currentId = meta?.parentWorkItemId ?? null;
  }

  return false;
}
