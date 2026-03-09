import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { TabId } from "./tab-id.js";

export type QueryIntakeUiModel = {
  uiState: QueryIntakeResponse["uiState"];
  trustState: QueryIntakeResponse["trustState"];
  statusCode: QueryIntakeResponse["statusCode"];
  errorCode: QueryIntakeResponse["errorCode"];
  guidance: string | null;
  freshness: {
    activeQueryId: string | null;
    lastRefreshAt: string | null;
    reloadSource: QueryIntakeResponse["reloadSource"];
  };
  capabilities: QueryIntakeResponse["capabilities"];
  strictFail: QueryIntakeResponse["strictFail"];
  mapping: {
    status: QueryIntakeResponse["mappingValidation"]["status"];
    issues: QueryIntakeResponse["mappingValidation"]["issues"];
    activeProfileId: string | null;
  };
  timeline: QueryIntakeResponse["timeline"];
  tabs: {
    id: TabId;
    label: string;
    badge: "ok" | "warning" | "blocked";
  }[];
};

export function mapQueryIntakeResponseToUiModel(response: QueryIntakeResponse): QueryIntakeUiModel {
  const mappingBlocked = response.mappingValidation.status === "invalid";
  const queryBlocked = response.capabilities.canSwitchQuery === false;
  const timelineBlocked = response.timeline === null || mappingBlocked;

  return {
    uiState: response.uiState,
    trustState: response.trustState,
    statusCode: response.statusCode,
    errorCode: response.errorCode,
    guidance: response.guidance,
    freshness: {
      activeQueryId: response.activeQueryId,
      lastRefreshAt: response.lastRefreshAt,
      reloadSource: response.reloadSource
    },
    capabilities: response.capabilities,
    strictFail: response.strictFail,
    mapping: {
      status: response.mappingValidation.status,
      issues: response.mappingValidation.issues,
      activeProfileId: response.activeMappingProfileId
    },
    timeline: response.timeline,
    tabs: [
      {
        id: "query",
        label: "Query",
        badge: queryBlocked ? "blocked" : "ok"
      },
      {
        id: "mapping",
        label: "Mapping",
        badge: mappingBlocked ? "warning" : "ok"
      },
      {
        id: "timeline",
        label: "Timeline",
        badge: timelineBlocked ? "blocked" : "ok"
      },
      {
        id: "diagnostics",
        label: "Diagnostics",
        badge: response.errorCode ? "warning" : "ok"
      }
    ]
  };
}
