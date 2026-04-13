import { describe, expect, it, vi } from "vitest";

import {
  applyPendingWorkItemMutationsToResponse,
  createPendingWorkItemMutation,
  flushPendingWorkItemMutations,
  upsertPendingWorkItemMutation,
  type PendingWorkItemMutation
} from "./ui-client-work-item-sync.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

function makeTimeline(title: string): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 1,
        title,
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: { mappedId: "1" }
      }
    ],
    unschedulable: [],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

function makeResponse(queryId = "query-1"): QueryIntakeResponse {
  return {
    activeQueryId: queryId,
    timeline: makeTimeline("Server title"),
    mappingValidation: {
      status: "valid",
      issues: []
    }
  } as unknown as QueryIntakeResponse;
}

describe("ui-client-work-item-sync", () => {
  it("reapplies pending mutations for the active query after refresh", () => {
    const response = makeResponse("query-1");
    const next = applyPendingWorkItemMutationsToResponse(response, [
      {
        kind: "work_item",
        key: "ignore",
        queryId: "query-2",
        workItemId: 1,
        applyToTimeline: () => makeTimeline("Other query"),
        executeSchedule: async () => undefined
      },
      {
        kind: "work_item",
        key: "keep",
        queryId: "query-1",
        workItemId: 1,
        applyToTimeline: () => makeTimeline("Local title"),
        executeSchedule: async () => undefined
      }
    ]);

    expect(next.timeline?.bars[0]?.title).toBe("Local title");
  });

  it("flushes queued mutations sequentially and updates pending count", async () => {
    const executed: string[] = [];
    const queueRef = {
      current: [
        {
          kind: "work_item",
          key: "first",
          queryId: "query-1",
          workItemId: 1,
          applyToTimeline: (timeline) => timeline,
          executeSchedule: async () => {
            executed.push("first");
          }
        },
        {
          kind: "work_item",
          key: "second",
          queryId: "query-1",
          workItemId: 2,
          applyToTimeline: (timeline) => timeline,
          executeDetails: async () => {
            executed.push("second");
          }
        }
      ] satisfies PendingWorkItemMutation[]
    };
    const pendingCounts: number[] = [];

    await flushPendingWorkItemMutations({
      queueRef,
      onPendingCountChange: (count) => {
        pendingCounts.push(count);
      },
      runTrackedWorkItemSync: async (operation) => operation()
    });

    expect(executed).toEqual(["first", "second"]);
    expect(queueRef.current).toEqual([]);
    expect(pendingCounts).toEqual([1, 0]);
  });

  it("keeps the failed mutation in the queue so push can retry later", async () => {
    const failingMutation = {
      kind: "dependency",
      key: "dep",
      queryId: "query-1",
      predecessorWorkItemId: 1,
      successorWorkItemId: 2,
      dependencyAction: "add",
      applyToTimeline: (timeline) => timeline,
      execute: vi.fn(async () => {
        throw new Error("boom");
      })
    } satisfies PendingWorkItemMutation;
    const queueRef = {
      current: [
        failingMutation,
        {
          kind: "work_item",
          key: "work",
          queryId: "query-1",
          workItemId: 3,
          applyToTimeline: (timeline) => timeline,
          executeSchedule: async () => undefined
        }
      ] satisfies PendingWorkItemMutation[]
    };

    await expect(
      flushPendingWorkItemMutations({
        queueRef,
        onPendingCountChange: vi.fn(),
        runTrackedWorkItemSync: async (operation) => operation()
      })
    ).rejects.toThrow("boom");

    expect(queueRef.current[0]).toBe(failingMutation);
    expect(queueRef.current).toHaveLength(2);
  });

  it("coalesces repeated changes for the same work item into one queue entry", () => {
    const first = createPendingWorkItemMutation({
      kind: "work_item",
      queryId: "query-1",
      workItemId: 11,
      applyToTimeline: () => makeTimeline("First local title"),
      executeSchedule: async () => undefined
    });
    const second = createPendingWorkItemMutation({
      kind: "work_item",
      queryId: "query-1",
      workItemId: 11,
      applyToTimeline: () => makeTimeline("Second local title"),
      executeSchedule: async () => undefined
    });

    const queue = upsertPendingWorkItemMutation([first], second);

    expect(queue).toHaveLength(1);
    expect(queue[0]?.kind).toBe("work_item");
    expect(queue[0]?.applyToTimeline(makeTimeline("Server title"))?.bars[0]?.title).toBe("Second local title");
  });

  it("keeps schedule and details updates for the same work item in one queue entry", async () => {
    const executed: string[] = [];
    const scheduleMutation = createPendingWorkItemMutation({
      kind: "work_item",
      queryId: "query-1",
      workItemId: 11,
      applyToTimeline: (timeline) => timeline,
      executeSchedule: async () => {
        executed.push("schedule");
      }
    });
    const detailsMutation = createPendingWorkItemMutation({
      kind: "work_item",
      queryId: "query-1",
      workItemId: 11,
      applyToTimeline: (timeline) => timeline,
      executeDetails: async () => {
        executed.push("details");
      }
    });
    const queueRef = {
      current: upsertPendingWorkItemMutation([scheduleMutation], detailsMutation)
    };

    await flushPendingWorkItemMutations({
      queueRef,
      onPendingCountChange: vi.fn(),
      runTrackedWorkItemSync: async (operation) => operation()
    });

    expect(executed).toEqual(["schedule", "details"]);
  });

  it("cancels opposite dependency changes for the same pair", () => {
    const addMutation = createPendingWorkItemMutation({
      kind: "dependency",
      queryId: "query-1",
      predecessorWorkItemId: 11,
      successorWorkItemId: 22,
      dependencyAction: "add",
      applyToTimeline: (timeline) => timeline,
      execute: async () => undefined
    });
    const removeMutation = createPendingWorkItemMutation({
      kind: "dependency",
      queryId: "query-1",
      predecessorWorkItemId: 11,
      successorWorkItemId: 22,
      dependencyAction: "remove",
      applyToTimeline: (timeline) => timeline,
      execute: async () => undefined
    });

    const queue = upsertPendingWorkItemMutation([addMutation], removeMutation);

    expect(queue).toEqual([]);
  });
});
