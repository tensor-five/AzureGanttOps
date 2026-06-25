import type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";

export type LocalConfigResetGuardInput = {
  pendingWorkItemSyncCount: number;
  detailsPanelDirty: boolean;
  hasOptimisticChanges: boolean;
  isRefreshing: boolean;
  headerQueryLoading: boolean;
  workItemSyncState: WorkItemSyncState;
};

export type LocalConfigResetGuard = {
  blocked: boolean;
  reasons: string[];
};

export function evaluateLocalConfigResetGuard(input: LocalConfigResetGuardInput): LocalConfigResetGuard {
  const reasons: string[] = [];

  if (input.pendingWorkItemSyncCount > 0) {
    reasons.push("Pending work item syncs are queued.");
  }

  if (input.detailsPanelDirty) {
    reasons.push("Details panel has unsaved edits.");
  }

  if (input.hasOptimisticChanges) {
    reasons.push("Optimistic timeline changes are active.");
  }

  if (input.isRefreshing) {
    reasons.push("Timeline refresh is running.");
  }

  if (input.headerQueryLoading) {
    reasons.push("Header query loading is running.");
  }

  if (input.workItemSyncState === "syncing") {
    reasons.push("Work item sync is running.");
  }

  return {
    blocked: reasons.length > 0,
    reasons
  };
}
