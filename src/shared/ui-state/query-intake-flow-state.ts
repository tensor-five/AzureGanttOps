import type { TabId } from "./tab-id.js";
import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

export function shouldOpenMappingFixTab(response: QueryIntakeResponse): boolean {
  return (
    response.preflightStatus === "READY" &&
    response.statusCode === "OK" &&
    response.mappingValidation.status === "invalid"
  );
}

export function deriveActiveTabForQueryResponse(response: QueryIntakeResponse): TabId {
  if (response.preflightStatus !== "READY") {
    return "query";
  }

  return shouldOpenMappingFixTab(response) ? "mapping" : "timeline";
}
