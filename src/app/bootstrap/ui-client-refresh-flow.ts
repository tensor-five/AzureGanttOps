import { ORG_KEY, PROJECT_KEY, QUERY_INPUT_KEY, resolveQueryRunInput } from "../../features/query-switching/runtime-query-input.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import { deriveActiveTabForQueryResponse, shouldOpenMappingFixTab } from "../../shared/ui-state/query-intake-flow-state.js";
import {
  AZURE_SESSION_EXPIRED_NEXT_ACTION,
  AZURE_SESSION_EXPIRED_REASON
} from "../../shared/azure-devops/azure-session-recovery.js";

export type RunRequest = {
  queryInput: string;
  mappingProfileId?: string;
  mappingProfileUpsert?: {
    id: string;
    name: string;
    fields: {
      id: string;
      title: string;
      start: string;
      endOrTarget: string;
    };
  };
};

export type RetryRefreshResult =
  | {
      kind: "refreshed";
      response: QueryIntakeResponse;
      openMappingFix: boolean;
      activeTab: ReturnType<typeof deriveActiveTabForQueryResponse>;
    }
  | {
      kind: "blocked_no_query";
      blocker: {
        tab: "query";
        reason: string;
        nextAction: string;
      };
    }
  | {
      kind: "query_triggered";
    };

export function buildSessionExpiredRefreshBlocker(): {
  tab: "query";
  reason: string;
  nextAction: string;
} {
  return {
    tab: "query",
    reason: AZURE_SESSION_EXPIRED_REASON,
    nextAction: AZURE_SESSION_EXPIRED_NEXT_ACTION
  };
}

export async function runRetryRefreshFlow(params: {
  lastRunRequest: RunRequest | null;
  submit: (request: RunRequest) => Promise<QueryIntakeResponse>;
  enrichRuntimeStateColors: (incoming: QueryIntakeResponse) => Promise<QueryIntakeResponse>;
  runQuery: (request: { queryId: string }) => Promise<QueryIntakeResponse>;
}): Promise<RetryRefreshResult> {
  if (params.lastRunRequest) {
    const refreshedRaw = await params.submit(params.lastRunRequest);
    const refreshed = await params.enrichRuntimeStateColors(refreshedRaw);
    return {
      kind: "refreshed",
      response: refreshed,
      openMappingFix: shouldOpenMappingFixTab(refreshed),
      activeTab: deriveActiveTabForQueryResponse(refreshed)
    };
  }

  const persistedQueryInput = resolvePersistedRefreshQueryInput();
  if (!persistedQueryInput) {
    return {
      kind: "blocked_no_query",
      blocker: {
        tab: "query",
        reason: "No query available to refresh.",
        nextAction: "Open OK menu, enter Query ID, then run query."
      }
    };
  }

  await params.runQuery({
    queryId: persistedQueryInput
  });
  return {
    kind: "query_triggered"
  };
}

export function resolvePersistedRefreshQueryInput(): string | null {
  const storage = resolveReadableStorage();
  if (!storage) {
    return null;
  }

  const rawQueryInput = storage.getItem(QUERY_INPUT_KEY)?.trim() ?? "";
  if (!rawQueryInput) {
    return null;
  }

  const organization = storage.getItem(ORG_KEY) ?? "";
  const project = storage.getItem(PROJECT_KEY) ?? "";
  return resolveQueryRunInput(rawQueryInput, organization, project);
}

function resolveReadableStorage(): Pick<Storage, "getItem"> | undefined {
  if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
    return localStorage;
  }

  return undefined;
}
