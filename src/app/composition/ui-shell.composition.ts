import { QueryClient } from "@tanstack/react-query";

import { AdoContextStore } from "../config/ado-context.store.js";
import { mapQueryIntakeResponseToUiModel, type QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import { QueryIntakeController } from "../../features/query-switching/query-intake.controller.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

export type AdoCommLogEntry = {
  seq: number;
  timestamp: string;
  direction: "request" | "response";
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  preview: string;
};

export type QueryIntakeTransport = {
  submit: (request: {
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
  }) => Promise<QueryIntakeResponse>;
  fetchAdoCommLogs: (params: { afterSeq: number; limit: number }) => Promise<{
    entries: AdoCommLogEntry[];
    nextSeq: number;
  }>;
  adoptWorkItemSchedule: (request: {
    targetWorkItemId: number;
    startDate: string;
    endDate: string;
  }) => Promise<{
    accepted: boolean;
    mode: "NO_OP" | "EXECUTED";
    commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
    operationCount: number;
    reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
  }>;
  updateWorkItemDetails: (request: {
    targetWorkItemId: number;
    title: string;
    descriptionHtml: string;
  }) => Promise<{
    accepted: boolean;
    mode: "NO_OP" | "EXECUTED";
    commandKind: "WORK_ITEM_PATCH" | "DEPENDENCY_LINK";
    operationCount: number;
    reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
  }>;
};

export type UiShellComposition = {
  queryClient: QueryClient;
  controller: QueryIntakeTransport;
  runQuerySelectionFlow: (params: {
    queryId: string;
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
  }) => Promise<{
    response: QueryIntakeResponse;
    uiModel: QueryIntakeUiModel;
  }>;
};

export function createUiShellComposition(params: {
  controller: QueryIntakeTransport;
  contextStore?: AdoContextStore;
}): UiShellComposition {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return {
    queryClient,
    controller: params.controller,
    runQuerySelectionFlow: async ({ queryId, mappingProfileId, mappingProfileUpsert }) => {
      const response = await params.controller.submit({
        queryInput: queryId,
        mappingProfileId,
        mappingProfileUpsert
      });

      return {
        response,
        uiModel: mapQueryIntakeResponseToUiModel(response)
      };
    }
  };
}

export function createLocalUiShellController(params: {
  contextStore: AdoContextStore;
  controller: QueryIntakeController;
}): QueryIntakeTransport {
  return {
    submit: async (request) => {
      await params.contextStore.getActiveContext();
      return params.controller.submit({
        queryInput: request.queryInput,
        mappingProfileId: request.mappingProfileId,
        mappingProfileUpsert: request.mappingProfileUpsert
      });
    },
    fetchAdoCommLogs: async () => ({
      entries: [],
      nextSeq: 0
    }),
    adoptWorkItemSchedule: async () => ({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 0,
      reasonCode: "WRITE_DISABLED"
    }),
    updateWorkItemDetails: async () => ({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 0,
      reasonCode: "WRITE_DISABLED"
    })
  };
}
