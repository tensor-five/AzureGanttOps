// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  applyTimelineMutationToUiState,
  runTrackedWorkItemSync,
  toWritebackError
} from "./ui-client-writeback-flow.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

function makeTimeline(id: string): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 1,
        title: id,
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

describe("ui-client-writeback-flow", () => {
  it("maps writeback reason code to stable error text", () => {
    expect(toWritebackError("WRITE_DISABLED").message).toBe("Writeback is disabled.");
    expect(toWritebackError("ANY_OTHER").message).toBe("Write failed.");
  });

  it("applies timeline mutation to ui model and response", () => {
    let uiModel = { timeline: makeTimeline("old") } as QueryIntakeUiModel;
    let response = { timeline: makeTimeline("old") } as QueryIntakeResponse | null;

    applyTimelineMutationToUiState(
      (updater) => {
        uiModel = typeof updater === "function" ? updater(uiModel) : updater;
      },
      (updater) => {
        response = typeof updater === "function" ? updater(response) : updater;
      },
      () => makeTimeline("new")
    );

    expect(uiModel.timeline?.bars[0]?.title).toBe("new");
    expect(response?.timeline?.bars[0]?.title).toBe("new");
  });

  it("tracks sync state lifecycle around successful operation", async () => {
    const inFlightRef = { current: 0 };
    const setState = vi.fn();

    const result = await runTrackedWorkItemSync({
      operation: async () => 42,
      inFlightRef,
      setWorkItemSyncState: setState
    });

    expect(result).toBe(42);
    expect(inFlightRef.current).toBe(0);
    expect(setState).toHaveBeenCalledWith("syncing");
  });

  it("tracks error state and rethrows on failed operation", async () => {
    const inFlightRef = { current: 0 };
    const setState = vi.fn();

    await expect(
      runTrackedWorkItemSync({
        operation: async () => {
          throw new Error("boom");
        },
        inFlightRef,
        setWorkItemSyncState: setState
      })
    ).rejects.toThrow("boom");

    expect(inFlightRef.current).toBe(0);
    expect(setState).toHaveBeenCalledWith("error");
  });
});
