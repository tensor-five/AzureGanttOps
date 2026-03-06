import { QueryClient } from "@tanstack/react-query";

import { AdoContextStore } from "../config/ado-context.store.js";
import { mapQueryIntakeResponseToUiModel, type QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import { QueryIntakeController } from "../../features/query-switching/query-intake.controller.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

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
};

export type UiShellComposition = {
  queryClient: QueryClient;
  controller: QueryIntakeTransport;
  runQuerySelectionFlow: (params: {
    queryId: string;
    mappingProfileId?: string;
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
    runQuerySelectionFlow: async ({ queryId, mappingProfileId }) => {
      const response = await params.controller.submit({
        queryInput: queryId,
        mappingProfileId
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
    }
  };
}
