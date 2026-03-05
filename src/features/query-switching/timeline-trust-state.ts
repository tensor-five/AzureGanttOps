export type TimelineUiState =
  | "loading"
  | "empty"
  | "auth_failure"
  | "query_failure"
  | "partial_failure"
  | "ready"
  | "ready_with_lkg_warning";

export type DeriveTimelineUiStateInput = {
  isLoading?: boolean;
  preflightStatus:
    | "READY"
    | "SESSION_EXPIRED"
    | "MISSING_EXTENSION"
    | "CONTEXT_MISMATCH"
    | "CLI_NOT_FOUND"
    | "UNKNOWN_ERROR";
  hasTimeline: boolean;
  hasAnyItems: boolean;
  hydrationStatusCode: string | null;
  hasStrictFailFallback: boolean;
  hasQueryFailure: boolean;
};

export function deriveTimelineUiState(input: DeriveTimelineUiStateInput): TimelineUiState {
  if (input.isLoading) {
    return "loading";
  }

  if (input.preflightStatus !== "READY") {
    return "auth_failure";
  }

  if (input.hasStrictFailFallback) {
    return "ready_with_lkg_warning";
  }

  if (input.hydrationStatusCode === "HYDRATION_PARTIAL_FAILURE") {
    return "partial_failure";
  }

  if (input.hasTimeline && input.hasAnyItems) {
    return "ready";
  }

  if (input.hasTimeline && !input.hasAnyItems) {
    return "empty";
  }

  if (input.hasQueryFailure) {
    return "query_failure";
  }

  return "empty";
}
