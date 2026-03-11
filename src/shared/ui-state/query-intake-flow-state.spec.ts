import { describe, expect, it } from "vitest";

import {
  deriveActiveTabForQueryResponse,
  shouldOpenMappingFixTab
} from "./query-intake-flow-state.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

function createResponse(overrides: Partial<QueryIntakeResponse>): QueryIntakeResponse {
  return {
    success: true,
    guidance: null,
    statusCode: "OK",
    errorCode: null,
    preflightStatus: "READY",
    selectedQueryId: null,
    activeQueryId: null,
    lastRefreshAt: null,
    reloadSource: "full_reload",
    uiState: "ready",
    trustState: "ready",
    strictFail: {
      active: false,
      message: null,
      retryActionLabel: null,
      dismissible: true,
      dismissed: false,
      lastSuccessfulRefreshAt: null,
      lastSuccessfulSource: null
    },
    capabilities: {
      canRefresh: true,
      canSwitchQuery: true,
      canChangeDensity: true,
      canOpenDetails: true,
      readOnlyTimeline: true
    },
    density: "comfortable",
    savedQueries: [],
    workItemIds: [],
    relations: [],
    timeline: null,
    mappingValidation: {
      status: "valid",
      issues: []
    },
    activeMappingProfileId: null,
    view: "",
    ...overrides
  };
}

describe("query-intake-flow-state", () => {
  it("opens mapping tab only for ready+ok+invalid-mapping response", () => {
    const mappingFixResponse = createResponse({
      mappingValidation: { status: "invalid", issues: [] }
    });
    expect(shouldOpenMappingFixTab(mappingFixResponse)).toBe(true);
    expect(deriveActiveTabForQueryResponse(mappingFixResponse)).toBe("mapping");

    const timelineResponse = createResponse({
      mappingValidation: { status: "valid", issues: [] }
    });
    expect(shouldOpenMappingFixTab(timelineResponse)).toBe(false);
    expect(deriveActiveTabForQueryResponse(timelineResponse)).toBe("timeline");
  });
});
