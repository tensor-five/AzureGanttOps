import type React from "react";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";

type WorkItemSyncState = "up_to_date" | "syncing" | "error";

export function toWritebackError(reasonCode: string): Error {
  return new Error(reasonCode === "WRITE_DISABLED" ? "Writeback is disabled." : "Write failed.");
}

export function applyTimelineMutationToUiState(
  setUiModel: React.Dispatch<React.SetStateAction<QueryIntakeUiModel>>,
  setResponse: React.Dispatch<React.SetStateAction<QueryIntakeResponse | null>>,
  mutation: (timeline: QueryIntakeUiModel["timeline"]) => QueryIntakeUiModel["timeline"]
): void {
  setUiModel((current) => ({
    ...current,
    timeline: mutation(current.timeline)
  }));
  setResponse((current) =>
    current
      ? {
          ...current,
          timeline: mutation(current.timeline)
        }
      : current
  );
}

export async function runTrackedWorkItemSync<T>(params: {
  operation: () => Promise<T>;
  inFlightRef: React.MutableRefObject<number>;
  setWorkItemSyncState: React.Dispatch<React.SetStateAction<WorkItemSyncState>>;
  setWorkItemSyncError: React.Dispatch<React.SetStateAction<string | null>>;
}): Promise<T> {
  params.inFlightRef.current += 1;
  params.setWorkItemSyncState("syncing");
  params.setWorkItemSyncError(null);

  try {
    return await params.operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Write failed.";
    params.setWorkItemSyncState("error");
    params.setWorkItemSyncError(message);
    throw error;
  } finally {
    params.inFlightRef.current = Math.max(0, params.inFlightRef.current - 1);
    if (params.inFlightRef.current === 0) {
      params.setWorkItemSyncState((current) => (current === "error" ? current : "up_to_date"));
    }
  }
}
