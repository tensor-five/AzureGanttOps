import { describe, expect, it } from "vitest";

import { evaluateLocalConfigResetGuard } from "./local-config-reset-guard.js";

describe("evaluateLocalConfigResetGuard", () => {
  it("blocks reset for dirty, loading and syncing states", () => {
    const guard = evaluateLocalConfigResetGuard({
      pendingWorkItemSyncCount: 2,
      detailsPanelDirty: true,
      hasOptimisticChanges: true,
      isRefreshing: true,
      headerQueryLoading: true,
      workItemSyncState: "syncing"
    });

    expect(guard).toEqual({
      blocked: true,
      reasons: [
        "Pending work item syncs are queued.",
        "Details panel has unsaved edits.",
        "Optimistic timeline changes are active.",
        "Timeline refresh is running.",
        "Header query loading is running.",
        "Work item sync is running."
      ]
    });
  });

  it("allows reset when no local changes or active loading states are present", () => {
    expect(
      evaluateLocalConfigResetGuard({
        pendingWorkItemSyncCount: 0,
        detailsPanelDirty: false,
        hasOptimisticChanges: false,
        isRefreshing: false,
        headerQueryLoading: false,
        workItemSyncState: "up_to_date"
      })
    ).toEqual({
      blocked: false,
      reasons: []
    });
  });
});
