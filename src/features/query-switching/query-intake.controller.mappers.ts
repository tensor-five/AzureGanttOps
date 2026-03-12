import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type {
  DiagnosticsErrorCode,
  DiagnosticsStatusCode
} from "../../application/dto/diagnostics/diagnostics-event.dto.js";
import type { QueryReloadSource } from "../../application/use-cases/run-query-intake.use-case.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";
import type { TimelineUiState } from "./timeline-trust-state.js";

export const FLAT_ONLY_NOTE = "Phase 2 note: only flat queries are supported.";

export function guidanceForPreflight(status: QueryIntakePreflightStatus): string | null {
  switch (status) {
    case "READY":
      return null;
    case "SESSION_EXPIRED":
      return "Session expired. Sign in to Azure and retry.";
    case "MISSING_EXTENSION":
      return "Azure DevOps extension missing. Install it and retry.";
    case "CONTEXT_MISMATCH":
      return "Azure defaults do not match this query. Update settings and retry.";
    case "CLI_NOT_FOUND":
      return "Azure CLI is not available. Install Azure CLI or set az.cmd path in Query tab, then retry.";
    case "UNKNOWN_ERROR":
    default:
      return "Could not validate Azure connection. Retry in a moment.";
  }
}

export function guidanceForRuntimeError(error: unknown): string {
  const code = toErrorCode(error);

  switch (code) {
    case "QUERY_NOT_FOUND":
      return "Query not found. Confirm query ID and try again.";
    case "QUERY_LIST_FAILED":
      return "Saved query listing failed. Check project access/permissions and retry.";
    case "QUERY_EXECUTION_FAILED":
      return "Query failed to run. Retry or verify query permissions.";
    case "QRY_SHAPE_UNSUPPORTED":
      return "Only flat queries are supported in this phase. Use a flat query and retry.";
    case "HYDRATION_REQUEST_FAILED":
      return "Work item hydration request failed. Verify field permissions and retry.";
    case "HYDRATION_TRANSIENT_RETRY_EXHAUSTED":
      return "Hydration retries were exhausted. Retry shortly.";
    case "MAP_PROFILE_NOT_FOUND":
      return "Mapping profile not found. Select an existing profile and retry.";
    case "MAP_VALIDATION_FAILED":
      return "Mapping profile is invalid. Fix required mappings and retry.";
    case "CONTEXT_REQUIRED":
      return "Add organization and project in settings.";
    case "MALFORMED_PAYLOAD":
      return "Unexpected Azure response. Retry shortly.";
    default:
      return "Unable to load query results. Retry in a moment.";
  }
}

export function guidanceForSnapshot(snapshot: { hydration: { statusCode: string } } | null): string | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.hydration.statusCode === "HYDRATION_PARTIAL_FAILURE") {
    return "Some work items could not be hydrated. Retry to improve completeness.";
  }

  return null;
}

export function guidanceForRuntimeState(source: QueryReloadSource): string | null {
  if (source === "stale_discarded") {
    return "Stale reload was discarded after query switch.";
  }

  return null;
}

export function guidanceForMappingIssues(issues: MappingValidationIssue[]): string {
  if (issues.length === 0) {
    return "Mapping profile is invalid. Fix required mappings and retry.";
  }

  const guidanceSteps = issues.map((issue) => `${issue.field}: ${issue.guidance}`);
  return `Fix required mapping fields before rendering timeline: ${guidanceSteps.join(" | ")}`;
}

export function toTrustState(uiState: TimelineUiState): QueryIntakeTrustState {
  if (uiState === "ready") {
    return "ready";
  }

  if (uiState === "partial_failure") {
    return "partial_failure";
  }

  return "needs_attention";
}

export function hasRenderableItems(timeline: TimelineReadModel | null): boolean {
  if (!timeline) {
    return false;
  }

  return timeline.bars.length > 0 || timeline.unschedulable.length > 0;
}

export function buildCapabilities(preflightStatus: QueryIntakePreflightStatus): QueryIntakeCapabilities {
  const hasActiveSession = preflightStatus === "READY";

  return {
    canRefresh: hasActiveSession,
    canSwitchQuery: hasActiveSession,
    canChangeDensity: true,
    canOpenDetails: true,
    readOnlyTimeline: true
  };
}

export function noStrictFailState(dismissed: boolean | undefined): QueryIntakeStrictFail {
  return {
    active: false,
    message: null,
    retryActionLabel: null,
    dismissible: true,
    dismissed: dismissed ?? false,
    lastSuccessfulRefreshAt: null,
    lastSuccessfulSource: null
  };
}

export function strictFailMessage(failureCode: string | null, lastSuccessfulRefreshAt: string | null): string {
  const failureContext = failureCode ? `Refresh failed (${failureCode}).` : "Refresh failed.";
  const freshnessContext = lastSuccessfulRefreshAt
    ? `Showing last successful timeline from ${lastSuccessfulRefreshAt}.`
    : "Showing last successful timeline.";

  return `${failureContext} ${freshnessContext} Retry now.`;
}

export function toErrorCode(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "UNKNOWN";
}

export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function deriveDiagnosticsStatusCodeFromResult(input: {
  preflightStatus: QueryIntakePreflightStatus;
  strictFailActive: boolean;
  reloadSource: QueryReloadSource;
  failureCode: string | null;
  uiState: TimelineUiState;
}): DiagnosticsStatusCode {
  if (input.preflightStatus !== "READY") {
    return input.preflightStatus;
  }

  if (input.strictFailActive) {
    return "STRICT_FAIL_FALLBACK";
  }

  if (input.reloadSource === "stale_discarded") {
    return "STALE_DISCARDED";
  }

  if (input.failureCode) {
    return toDiagnosticsStatusCode(input.failureCode);
  }

  if (input.uiState === "partial_failure") {
    return "HYDRATION_PARTIAL_FAILURE";
  }

  return "OK";
}

export function toDiagnosticsErrorCode(code: string | null): DiagnosticsErrorCode | null {
  if (!code) {
    return null;
  }

  const statusCode = toDiagnosticsStatusCode(code);
  return statusCode === "OK" ? null : statusCode;
}

export function toDiagnosticsStatusCode(code: string): DiagnosticsStatusCode {
  const canonicalCode = normalizeDiagnosticsCode(code);
  return DETERMINISTIC_DIAGNOSTICS_CODES.has(canonicalCode as DiagnosticsStatusCode)
    ? (canonicalCode as DiagnosticsStatusCode)
    : "UNKNOWN_ERROR";
}

function normalizeDiagnosticsCode(code: string): string {
  const withoutDetails = code.includes(":") ? (code.split(":", 1)[0] ?? code) : code;
  if (!withoutDetails.includes("_HTTP_")) {
    return withoutDetails;
  }

  const [baseCode] = withoutDetails.split("_HTTP_", 1);
  return baseCode ?? withoutDetails;
}

const DETERMINISTIC_DIAGNOSTICS_CODES: ReadonlySet<DiagnosticsStatusCode> = new Set<DiagnosticsStatusCode>([
  "OK",
  "SESSION_EXPIRED",
  "MISSING_EXTENSION",
  "CONTEXT_MISMATCH",
  "CLI_NOT_FOUND",
  "UNKNOWN_ERROR",
  "QUERY_NOT_FOUND",
  "QUERY_LIST_FAILED",
  "QUERY_EXECUTION_FAILED",
  "QRY_SHAPE_UNSUPPORTED",
  "HYDRATION_REQUEST_FAILED",
  "HYDRATION_TRANSIENT_RETRY_EXHAUSTED",
  "HYDRATION_PARTIAL_FAILURE",
  "MAP_PROFILE_NOT_FOUND",
  "MAP_VALIDATION_FAILED",
  "CONTEXT_REQUIRED",
  "MALFORMED_PAYLOAD",
  "STALE_DISCARDED",
  "STRICT_FAIL_FALLBACK"
]);

type QueryIntakePreflightStatus =
  | "READY"
  | "SESSION_EXPIRED"
  | "MISSING_EXTENSION"
  | "CONTEXT_MISMATCH"
  | "CLI_NOT_FOUND"
  | "UNKNOWN_ERROR";

type QueryIntakeTrustState = "ready" | "needs_attention" | "partial_failure";

type QueryIntakeStrictFail = {
  active: boolean;
  message: string | null;
  retryActionLabel: string | null;
  dismissible: boolean;
  dismissed: boolean;
  lastSuccessfulRefreshAt: string | null;
  lastSuccessfulSource: QueryReloadSource | null;
};

type QueryIntakeCapabilities = {
  canRefresh: boolean;
  canSwitchQuery: boolean;
  canChangeDensity: boolean;
  canOpenDetails: boolean;
  readOnlyTimeline: boolean;
};
