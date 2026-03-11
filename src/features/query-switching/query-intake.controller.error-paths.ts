import { deriveTimelineUiState, type TimelineUiState } from "./timeline-trust-state.js";
import {
  buildCapabilities,
  FLAT_ONLY_NOTE,
  guidanceForRuntimeError,
  noStrictFailState,
  toDiagnosticsErrorCode,
  toDiagnosticsStatusCode,
  toErrorCode,
  toTrustState,
  toUserMessage
} from "./query-intake.controller.mappers.js";
import type {
  DiagnosticsErrorCode,
  DiagnosticsStatusCode
} from "../../application/dto/diagnostics/diagnostics-event.dto.js";

export type QueryIntakeFailureState = {
  guidance: string;
  preflightStatus: "READY" | "UNKNOWN_ERROR";
  uiState: TimelineUiState;
  trustState: "ready" | "needs_attention" | "partial_failure";
  strictFail: {
    active: boolean;
    message: string | null;
    retryActionLabel: string | null;
    dismissible: boolean;
    dismissed: boolean;
    lastSuccessfulRefreshAt: string | null;
    lastSuccessfulSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
  };
  capabilities: {
    canRefresh: boolean;
    canSwitchQuery: boolean;
    canChangeDensity: boolean;
    canOpenDetails: boolean;
    readOnlyTimeline: boolean;
  };
  statusCode: DiagnosticsStatusCode;
  errorCode: DiagnosticsErrorCode | null;
  flatQuerySupportNote: string;
};

export function buildParseErrorFailureState(input: {
  error: unknown;
  dismissStrictFailWarning: boolean | undefined;
}): QueryIntakeFailureState {
  const guidance = toUserMessage(input.error, "Paste a valid Azure DevOps query URL or query ID.");
  const uiState = "query_failure" as const;

  return {
    guidance,
    preflightStatus: "UNKNOWN_ERROR",
    uiState,
    trustState: "needs_attention",
    strictFail: noStrictFailState(input.dismissStrictFailWarning),
    capabilities: buildCapabilities("UNKNOWN_ERROR"),
    statusCode: "UNKNOWN_ERROR",
    errorCode: "UNKNOWN_ERROR",
    flatQuerySupportNote: FLAT_ONLY_NOTE
  };
}

export function buildRuntimeErrorFailureState(input: {
  error: unknown;
  dismissStrictFailWarning: boolean | undefined;
}): QueryIntakeFailureState {
  const preflightStatus = "READY" as const;
  const uiState = deriveTimelineUiState({
    preflightStatus,
    hasTimeline: false,
    hasAnyItems: false,
    hydrationStatusCode: null,
    hasStrictFailFallback: false,
    hasQueryFailure: true
  });
  const statusCode = toDiagnosticsStatusCode(toErrorCode(input.error));

  return {
    guidance: guidanceForRuntimeError(input.error),
    preflightStatus,
    uiState,
    trustState: toTrustState(uiState),
    strictFail: noStrictFailState(input.dismissStrictFailWarning),
    capabilities: buildCapabilities(preflightStatus),
    statusCode,
    errorCode: toDiagnosticsErrorCode(toErrorCode(input.error)),
    flatQuerySupportNote: FLAT_ONLY_NOTE
  };
}
