import type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";

export type RefreshDiscardWarningInput = {
  detailsPanelDirty: boolean;
  pendingWorkItemMutationCount: number;
  hasOptimisticChanges: boolean;
  liveSyncEnabled: boolean;
  workItemSyncState: WorkItemSyncState;
};

export type RefreshDiscardWarningState = Omit<RefreshDiscardWarningInput, "pendingWorkItemMutationCount">;

export function createRefreshDiscardWarningInput(params: {
  state: RefreshDiscardWarningState;
  pendingWorkItemMutationCount: number;
  afterSuccessfulLiveSyncFlush?: boolean;
}): RefreshDiscardWarningInput {
  const queueWasDrainedByLiveSync =
    params.afterSuccessfulLiveSyncFlush === true &&
    params.pendingWorkItemMutationCount === 0 &&
    params.state.liveSyncEnabled;

  return {
    detailsPanelDirty: params.state.detailsPanelDirty,
    pendingWorkItemMutationCount: params.pendingWorkItemMutationCount,
    hasOptimisticChanges: queueWasDrainedByLiveSync ? false : params.state.hasOptimisticChanges,
    liveSyncEnabled: params.state.liveSyncEnabled,
    workItemSyncState: queueWasDrainedByLiveSync ? "up_to_date" : params.state.workItemSyncState
  };
}

export function shouldFlushLiveSyncBeforeRefresh(input: RefreshDiscardWarningInput): boolean {
  return input.liveSyncEnabled && !input.detailsPanelDirty && input.pendingWorkItemMutationCount > 0;
}

export function shouldShowRefreshDiscardWarning(input: RefreshDiscardWarningInput): boolean {
  if (input.detailsPanelDirty) {
    return true;
  }

  if (input.pendingWorkItemMutationCount > 0) {
    return true;
  }

  if (!input.hasOptimisticChanges) {
    return false;
  }

  return !input.liveSyncEnabled || input.workItemSyncState === "error";
}

export function runWithInFlightGuard<T>(
  inFlightRef: { current: Promise<T> | null },
  operation: () => Promise<T>
): Promise<T> {
  if (inFlightRef.current) {
    return inFlightRef.current;
  }

  const next = Promise.resolve()
    .then(operation)
    .finally(() => {
      if (inFlightRef.current === next) {
        inFlightRef.current = null;
      }
    });
  inFlightRef.current = next;
  return next;
}
