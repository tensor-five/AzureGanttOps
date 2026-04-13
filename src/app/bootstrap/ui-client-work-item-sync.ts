import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";

export type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";

type TimelineMutation = (
  timeline: QueryIntakeResponse["timeline"]
) => QueryIntakeResponse["timeline"];

export type PendingWorkItemMutation =
  | {
      kind: "work_item";
      key: string;
      queryId: string | null;
      workItemId: number;
      applyToTimeline: TimelineMutation;
      executeSchedule?: () => Promise<void>;
      executeDetails?: () => Promise<void>;
    }
  | {
      kind: "dependency";
      key: string;
      queryId: string | null;
      predecessorWorkItemId: number;
      successorWorkItemId: number;
      dependencyAction: "add" | "remove";
      applyToTimeline: TimelineMutation;
      execute: () => Promise<void>;
    }
  | {
      kind: "reparent";
      key: string;
      queryId: string | null;
      targetWorkItemId: number;
      newParentId: number | null;
      applyToTimeline: TimelineMutation;
      execute: () => Promise<void>;
    };

export type PendingWorkItemMutationDraft =
  | {
      kind: "work_item";
      queryId: string | null;
      workItemId: number;
      applyToTimeline: TimelineMutation;
      executeSchedule?: () => Promise<void>;
      executeDetails?: () => Promise<void>;
    }
  | {
      kind: "dependency";
      queryId: string | null;
      predecessorWorkItemId: number;
      successorWorkItemId: number;
      dependencyAction: "add" | "remove";
      applyToTimeline: TimelineMutation;
      execute: () => Promise<void>;
    }
  | {
      kind: "reparent";
      queryId: string | null;
      targetWorkItemId: number;
      newParentId: number | null;
      applyToTimeline: TimelineMutation;
      execute: () => Promise<void>;
    };

export function createPendingWorkItemMutation(draft: PendingWorkItemMutationDraft): PendingWorkItemMutation {
  if (draft.kind === "work_item") {
    return {
      ...draft,
      key: `work_item::${draft.queryId ?? "__global__"}::${draft.workItemId}`
    };
  }

  if (draft.kind === "reparent") {
    return {
      ...draft,
      key: `reparent::${draft.queryId ?? "__global__"}::${draft.targetWorkItemId}::${draft.newParentId ?? "root"}`
    };
  }

  return {
    ...draft,
    key: `dependency::${draft.queryId ?? "__global__"}::${draft.predecessorWorkItemId}::${draft.successorWorkItemId}`
  };
}

export function applyPendingWorkItemMutationsToResponse(
  response: QueryIntakeResponse,
  pendingMutations: ReadonlyArray<PendingWorkItemMutation>
): QueryIntakeResponse {
  if (!response.timeline || !response.activeQueryId || pendingMutations.length === 0) {
    return response;
  }

  const relevantMutations = pendingMutations.filter((mutation) => mutation.queryId === response.activeQueryId);
  if (relevantMutations.length === 0) {
    return response;
  }

  return {
    ...response,
    timeline: relevantMutations.reduce<QueryIntakeResponse["timeline"]>((timeline, mutation) => {
      return mutation.applyToTimeline(timeline);
    }, response.timeline)
  };
}

export function upsertPendingWorkItemMutation(
  queue: ReadonlyArray<PendingWorkItemMutation>,
  mutation: PendingWorkItemMutation
): PendingWorkItemMutation[] {
  const existingIndex = queue.findIndex((entry) => entry.key === mutation.key);
  if (existingIndex === -1) {
    return [...queue, mutation];
  }

  const existing = queue[existingIndex];
  if (!existing) {
    return [...queue, mutation];
  }

  if (existing.kind === "work_item" && mutation.kind === "work_item") {
    const next = [...queue];
    next[existingIndex] = {
      ...existing,
      applyToTimeline: composeTimelineMutations(existing.applyToTimeline, mutation.applyToTimeline),
      executeSchedule: mutation.executeSchedule ?? existing.executeSchedule,
      executeDetails: mutation.executeDetails ?? existing.executeDetails
    };
    return next;
  }

  if (existing.kind === "dependency" && mutation.kind === "dependency") {
    if (existing.dependencyAction !== mutation.dependencyAction) {
      return queue.filter((entry) => entry.key !== mutation.key);
    }

    const next = [...queue];
    next[existingIndex] = {
      ...existing,
      applyToTimeline: composeTimelineMutations(existing.applyToTimeline, mutation.applyToTimeline),
      execute: mutation.execute
    };
    return next;
  }

  const next = [...queue];
  next[existingIndex] = mutation;
  return next;
}

export async function flushPendingWorkItemMutations(params: {
  queueRef: { current: PendingWorkItemMutation[] };
  onPendingCountChange: (count: number) => void;
  runTrackedWorkItemSync: (operation: () => Promise<void>) => Promise<void>;
}): Promise<void> {
  while (params.queueRef.current.length > 0) {
    const [nextMutation] = params.queueRef.current;
    if (!nextMutation) {
      return;
    }

    await params.runTrackedWorkItemSync(async () => {
      if (nextMutation.kind === "work_item") {
        if (nextMutation.executeSchedule) {
          await nextMutation.executeSchedule();
        }

        if (nextMutation.executeDetails) {
          await nextMutation.executeDetails();
        }
        return;
      }

      await nextMutation.execute();
    });
    params.queueRef.current = params.queueRef.current.slice(1);
    params.onPendingCountChange(params.queueRef.current.length);
  }
}

function composeTimelineMutations(first: TimelineMutation, second: TimelineMutation): TimelineMutation {
  return (timeline) => second(first(timeline));
}
