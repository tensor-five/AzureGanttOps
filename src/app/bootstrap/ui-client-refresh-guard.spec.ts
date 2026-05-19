import { describe, expect, it, vi } from "vitest";

import {
  createRefreshDiscardWarningInput,
  runWithInFlightGuard,
  shouldFlushLiveSyncBeforeRefresh,
  shouldShowRefreshDiscardWarning
} from "./ui-client-refresh-guard.js";

describe("ui-client-refresh-guard", () => {
  it("warns for dirty details even when live sync is up to date", () => {
    expect(
      shouldShowRefreshDiscardWarning({
        detailsPanelDirty: true,
        pendingWorkItemMutationCount: 0,
        hasOptimisticChanges: false,
        liveSyncEnabled: true,
        workItemSyncState: "up_to_date"
      })
    ).toBe(true);
  });

  it("does not warn when no local changes are at risk", () => {
    expect(
      shouldShowRefreshDiscardWarning({
        detailsPanelDirty: false,
        pendingWorkItemMutationCount: 0,
        hasOptimisticChanges: false,
        liveSyncEnabled: true,
        workItemSyncState: "up_to_date"
      })
    ).toBe(false);
  });

  it("warns for queued timeline changes while live sync is paused", () => {
    expect(
      shouldShowRefreshDiscardWarning({
        detailsPanelDirty: false,
        pendingWorkItemMutationCount: 1,
        hasOptimisticChanges: false,
        liveSyncEnabled: false,
        workItemSyncState: "paused"
      })
    ).toBe(true);
  });

  it("requests a live-sync flush before refresh when queued timeline changes exist", () => {
    expect(
      shouldFlushLiveSyncBeforeRefresh({
        detailsPanelDirty: false,
        pendingWorkItemMutationCount: 1,
        hasOptimisticChanges: true,
        liveSyncEnabled: true,
        workItemSyncState: "syncing"
      })
    ).toBe(true);
  });

  it("does not request a live-sync flush when dirty details already require confirmation", () => {
    expect(
      shouldFlushLiveSyncBeforeRefresh({
        detailsPanelDirty: true,
        pendingWorkItemMutationCount: 1,
        hasOptimisticChanges: true,
        liveSyncEnabled: true,
        workItemSyncState: "syncing"
      })
    ).toBe(false);
  });

  it("does not warn for optimistic timeline changes already handled by active live sync", () => {
    expect(
      shouldShowRefreshDiscardWarning({
        detailsPanelDirty: false,
        pendingWorkItemMutationCount: 0,
        hasOptimisticChanges: true,
        liveSyncEnabled: true,
        workItemSyncState: "up_to_date"
      })
    ).toBe(false);
  });

  it("keeps the warning while queued live-sync changes are still unresolved", () => {
    expect(
      shouldShowRefreshDiscardWarning({
        detailsPanelDirty: false,
        pendingWorkItemMutationCount: 1,
        hasOptimisticChanges: true,
        liveSyncEnabled: true,
        workItemSyncState: "syncing"
      })
    ).toBe(true);
  });

  it("keeps the warning when live sync failed with optimistic changes", () => {
    expect(
      shouldShowRefreshDiscardWarning({
        detailsPanelDirty: false,
        pendingWorkItemMutationCount: 0,
        hasOptimisticChanges: true,
        liveSyncEnabled: true,
        workItemSyncState: "error"
      })
    ).toBe(true);
  });

  it("keeps fresh dirty details after a live-sync flush drains queued mutations", () => {
    const input = createRefreshDiscardWarningInput({
      state: {
        detailsPanelDirty: true,
        hasOptimisticChanges: true,
        liveSyncEnabled: true,
        workItemSyncState: "syncing"
      },
      pendingWorkItemMutationCount: 0,
      afterSuccessfulLiveSyncFlush: true
    });

    expect(input).toEqual({
      detailsPanelDirty: true,
      pendingWorkItemMutationCount: 0,
      hasOptimisticChanges: false,
      liveSyncEnabled: true,
      workItemSyncState: "up_to_date"
    });
    expect(shouldShowRefreshDiscardWarning(input)).toBe(true);
  });

  it("does not clear optimistic changes while a live-sync flush still has queued mutations", () => {
    expect(
      createRefreshDiscardWarningInput({
        state: {
          detailsPanelDirty: false,
          hasOptimisticChanges: true,
          liveSyncEnabled: true,
          workItemSyncState: "syncing"
        },
        pendingWorkItemMutationCount: 1,
        afterSuccessfulLiveSyncFlush: true
      })
    ).toEqual({
      detailsPanelDirty: false,
      pendingWorkItemMutationCount: 1,
      hasOptimisticChanges: true,
      liveSyncEnabled: true,
      workItemSyncState: "syncing"
    });
  });

  it("shares one in-flight promise until the guarded operation settles", async () => {
    const inFlightRef: { current: Promise<void> | null } = { current: null };
    let resolveOperation: () => void = () => undefined;
    const operation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveOperation = resolve;
        })
    );

    const first = runWithInFlightGuard(inFlightRef, operation);
    const second = runWithInFlightGuard(inFlightRef, operation);

    expect(second).toBe(first);
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);

    resolveOperation();
    await first;

    expect(inFlightRef.current).toBeNull();
  });

  it("clears the in-flight guard after rejected operations", async () => {
    const inFlightRef: { current: Promise<void> | null } = { current: null };

    await expect(
      runWithInFlightGuard(inFlightRef, async () => {
        throw new Error("refresh failed");
      })
    ).rejects.toThrow("refresh failed");

    expect(inFlightRef.current).toBeNull();
  });
});
