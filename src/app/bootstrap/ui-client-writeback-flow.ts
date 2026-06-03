import type React from "react";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";

export function toWritebackError(reasonCode: string): Error {
  if (reasonCode === "WRITE_DISABLED") {
    return new Error("Writeback is disabled.");
  }

  if (reasonCode === "WRITE_UNSUPPORTED") {
    return new Error("Writeback operation is not supported by this Azure DevOps connection.");
  }

  if (reasonCode === "WORK_ITEM_CHILD_TYPE_UNAVAILABLE") {
    return new Error("Selected child work item type is not available in this Azure DevOps project.");
  }

  return new Error("Write failed.");
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
}): Promise<T> {
  params.inFlightRef.current += 1;
  params.setWorkItemSyncState("syncing");

  try {
    return await params.operation();
  } catch (error) {
    params.setWorkItemSyncState("error");
    throw error;
  } finally {
    params.inFlightRef.current = Math.max(0, params.inFlightRef.current - 1);
    if (params.inFlightRef.current === 0) {
      params.setWorkItemSyncState((current) => (current === "error" ? current : "up_to_date"));
    }
  }
}
