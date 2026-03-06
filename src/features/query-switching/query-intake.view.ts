import type {
  DiagnosticsErrorCode,
  DiagnosticsStatusCode
} from "../../application/dto/diagnostics/diagnostics-event.dto.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { SavedQuery } from "../../application/ports/query-runtime.port.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";
import type { TimelineUiState } from "./timeline-trust-state.js";
import { buildTimelinePaneLines } from "../gantt-view/timeline-pane.js";
import { createTimelineSelectionStore } from "../gantt-view/selection-store.js";
import { renderTrustBadgeLine } from "../diagnostics/trust-badge.js";
import { buildDiagnosticsTabLines } from "../diagnostics/diagnostics-tab.js";
import { buildWarningBannerLines } from "../diagnostics/warning-banner.js";
import { saveLastDensity } from "../gantt-view/timeline-density-preference.js";

export type QueryIntakeViewModel = {
  success: boolean;
  guidance: string | null;
  statusCode: DiagnosticsStatusCode;
  errorCode: DiagnosticsErrorCode | null;
  flatQuerySupportNote: string;
  activeQueryId: string | null;
  lastRefreshAt: string | null;
  reloadSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
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
  density: "comfortable" | "compact";
  savedQueries: SavedQuery[];
  selectedQueryId: string | null;
  timeline: TimelineReadModel | null;
  mappingValidation: {
    status: "valid" | "invalid";
    issues: MappingValidationIssue[];
  };
  showDependencies: boolean;
};

export function renderQueryIntakeView(model: QueryIntakeViewModel): string {
  const density = model.density;
  saveLastDensity(density);

  const selectionStore = createTimelineSelectionStore();
  if (model.timeline?.bars[0]) {
    selectionStore.select(model.timeline.bars[0].workItemId);
  }

  const statusLine = model.success ? "[OK] Ready" : "[ ] Needs attention";
  const uiStateLine = `UI state: ${model.uiState}`;
  const trustLine = `Trust state: ${model.trustState}`;
  const guidanceLine = model.guidance ? `Action: ${model.guidance}` : "Action: none";

  const trustBadgeLine = renderTrustBadgeLine({
    statusCode: model.statusCode,
    trustState: model.trustState,
    lastRefreshAt: model.lastRefreshAt,
    readOnlyTimeline: model.capabilities.readOnlyTimeline
  });

  const diagnosticsLines = buildDiagnosticsTabLines({
    statusCode: model.statusCode,
    errorCode: model.errorCode,
    guidance: model.guidance,
    sourceHealth: toSourceHealthLabel(model),
    activeQueryId: model.activeQueryId,
    lastRefreshAt: model.lastRefreshAt,
    reloadSource: model.reloadSource
  });

  const warningLines = buildWarningBannerLines({
    uiState: model.uiState,
    guidance: model.strictFail.message ?? model.guidance,
    retryActionLabel: model.strictFail.retryActionLabel,
    hasStrictFailFallback: model.strictFail.active
  });

  const selectedLine = model.selectedQueryId ? `Selected query: ${model.selectedQueryId}` : "Selected query: none";
  const activeSourceLine = model.activeQueryId ? `Active query source: ${model.activeQueryId}` : "Active query source: none";
  const refreshLine = model.lastRefreshAt ? `Last refresh: ${model.lastRefreshAt}` : "Last refresh: none";
  const reloadLine = model.reloadSource ? `Reload source: ${model.reloadSource}` : "Reload source: none";
  const queryLines = model.savedQueries.length
    ? model.savedQueries.map((query) => `- ${query.name} (${query.id})`).join("\n")
    : "- none";

  const strictFailLines = renderStrictFailBanner(model.strictFail);
  const capabilityLines = renderCapabilityMatrix(model.capabilities);
  const sessionNoticeLines = renderSessionNotice(model.capabilities);
  const densityLines = [`Density mode: ${density}`];
  const navigationLines = [
    "Navigation container:",
    "- overflow-x: auto",
    "- overflow-y: auto",
    "- bi-directional: enabled"
  ];
  const mappingLines = renderMappingValidation(model.mappingValidation);
  const timelineLines = buildTimelinePaneLines({
    timeline: model.timeline,
    showDependencies: model.showDependencies,
    selectionStore
  });

  return [
    statusLine,
    uiStateLine,
    trustLine,
    `Trust badge: ${trustBadgeLine}`,
    model.flatQuerySupportNote,
    guidanceLine,
    ...diagnosticsLines,
    selectedLine,
    activeSourceLine,
    refreshLine,
    reloadLine,
    ...strictFailLines,
    ...warningLines,
    ...sessionNoticeLines,
    "Capabilities:",
    ...capabilityLines,
    ...densityLines,
    ...navigationLines,
    "Saved queries:",
    queryLines,
    "Mapping validation:",
    ...mappingLines,
    ...timelineLines
  ].join("\n");
}

function renderStrictFailBanner(strictFail: QueryIntakeViewModel["strictFail"]): string[] {
  if (!strictFail.active || strictFail.dismissed) {
    return [];
  }

  const lines = ["[WARN] Strict-fail fallback active"];

  if (strictFail.message) {
    lines.push(`- ${strictFail.message}`);
  }

  if (strictFail.lastSuccessfulRefreshAt) {
    lines.push(`- Last successful refresh: ${strictFail.lastSuccessfulRefreshAt}`);
  }

  if (strictFail.retryActionLabel) {
    lines.push(`- Action: ${strictFail.retryActionLabel}`);
  }

  if (strictFail.dismissible) {
    lines.push("- Dismiss: available for current state");
  }

  return lines;
}

function renderSessionNotice(capabilities: QueryIntakeViewModel["capabilities"]): string[] {
  if (capabilities.canRefresh && capabilities.canSwitchQuery) {
    return [];
  }

  return [
    "[NOTICE] No active session: timeline remains read-only",
    "- Reload and query switching are disabled until session is restored"
  ];
}

function renderCapabilityMatrix(capabilities: QueryIntakeViewModel["capabilities"]): string[] {
  return [
    `- canRefresh: ${capabilities.canRefresh ? "enabled" : "disabled"}`,
    `- canSwitchQuery: ${capabilities.canSwitchQuery ? "enabled" : "disabled"}`,
    `- canChangeDensity: ${capabilities.canChangeDensity ? "enabled" : "disabled"}`,
    `- canOpenDetails: ${capabilities.canOpenDetails ? "enabled" : "disabled"}`,
    `- readOnlyTimeline: ${capabilities.readOnlyTimeline ? "true" : "false"}`
  ];
}

function renderMappingValidation(validation: QueryIntakeViewModel["mappingValidation"]): string[] {
  if (validation.status === "valid") {
    return ["- status: valid", "- issues: none"];
  }

  return [
    "- status: invalid",
    ...validation.issues.map(
      (issue) => `- ${issue.field} [${issue.code}] ${issue.message} | ${issue.guidance}`
    )
  ];
}

function toSourceHealthLabel(model: QueryIntakeViewModel):
  | "HEALTHY"
  | "AUTH_EXPIRED_REAUTH_TRIGGERED"
  | "AUTH_WARNING"
  | "REFRESH_FAILED_LKG_ACTIVE"
  | "REFRESH_FAILED_NO_LKG" {
  if (model.statusCode === "SESSION_EXPIRED") {
    return "AUTH_EXPIRED_REAUTH_TRIGGERED";
  }

  if (
    model.statusCode === "MISSING_EXTENSION" ||
    model.statusCode === "CONTEXT_MISMATCH" ||
    model.statusCode === "CLI_NOT_FOUND"
  ) {
    return "AUTH_WARNING";
  }

  if (model.statusCode === "STRICT_FAIL_FALLBACK") {
    return "REFRESH_FAILED_LKG_ACTIVE";
  }

  if (
    model.errorCode === "QUERY_EXECUTION_FAILED" ||
    model.errorCode === "HYDRATION_TRANSIENT_RETRY_EXHAUSTED" ||
    model.errorCode === "MALFORMED_PAYLOAD" ||
    model.errorCode === "UNKNOWN_ERROR"
  ) {
    return model.lastRefreshAt ? "REFRESH_FAILED_LKG_ACTIVE" : "REFRESH_FAILED_NO_LKG";
  }

  return "HEALTHY";
}
