import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { UserPreferences } from "../../shared/user-preferences/user-preferences.client.js";
export type InitialQueryOnboardingStatus = "pending_hydration" | "required" | "completed";

export function resolveInitialQueryOnboardingStatus(params: {
  hydrationState: "pending" | "hydrated";
  preferences: UserPreferences | null;
  restoredResponse: QueryIntakeResponse | null;
}): InitialQueryOnboardingStatus {
  if (params.hydrationState === "pending") {
    return "pending_hydration";
  }

  if (hasSavedQueries(params.preferences) || isCompletedRestoredQueryResponse(params.restoredResponse)) {
    return "completed";
  }

  return "required";
}

function hasSavedQueries(preferences: UserPreferences | null): boolean {
  return (preferences?.savedQueries ?? []).length > 0;
}

function isCompletedRestoredQueryResponse(
  response: QueryIntakeResponse | null
): response is QueryIntakeResponse & { activeQueryId: string } {
  return response?.preflightStatus === "READY" && response.statusCode === "OK" && Boolean(response.activeQueryId);
}
