import type {
  DiagnosticsErrorCode,
  DiagnosticsStatusCode
} from "../../application/dto/diagnostics/diagnostics-event.dto.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { SavedQuery } from "../../application/ports/query-runtime.port.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";
import type { TimelineUiState } from "./timeline-trust-state.js";

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

const MAX_PRIMARY_TITLE_LENGTH = 42;

export function renderQueryIntakeView(model: QueryIntakeViewModel): string {
  const statusLine = model.success ? "[OK] Ready" : "[ ] Needs attention";
  const uiStateLine = `UI state: ${model.uiState}`;
  const trustLine = `Trust state: ${model.trustState}`;
  const guidanceLine = model.guidance ? `Action: ${model.guidance}` : "Action: none";
  const diagnosticsLines = [
    "Diagnostics:",
    `- status code: ${model.statusCode}`,
    `- error code: ${model.errorCode ?? "none"}`,
    `- guidance: ${model.guidance ?? "none"}`,
    `- source health: ${toSourceHealthLabel(model)}`,
    `- handoff code: ${model.errorCode ?? model.statusCode}`,
    `- active query source: ${model.activeQueryId ?? "none"}`,
    `- last successful refresh: ${model.lastRefreshAt ?? "none"}`,
    `- reload source: ${model.reloadSource ?? "none"}`
  ];
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
  const densityLines = [`Density mode: ${model.density}`];
  const navigationLines = [
    "Navigation container:",
    "- overflow-x: auto",
    "- overflow-y: auto",
    "- bi-directional: enabled"
  ];
  const mappingLines = renderMappingValidation(model.mappingValidation);
  const timelineLines = renderTimeline(model.timeline, model.showDependencies);

  return [
    statusLine,
    uiStateLine,
    trustLine,
    model.flatQuerySupportNote,
    guidanceLine,
    ...diagnosticsLines,
    selectedLine,
    activeSourceLine,
    refreshLine,
    reloadLine,
    ...strictFailLines,
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

function renderTimeline(timeline: TimelineReadModel | null, showDependencies: boolean): string[] {
  if (!timeline) {
    return [
      "Timeline:",
      "- unavailable"
    ];
  }

  const bars = timeline.bars.length
    ? timeline.bars.map((bar) => {
        const title = truncateTitle(bar.title);
        const halfOpenMarker = bar.schedule.missingBoundary ? ` [half-open:${bar.schedule.missingBoundary}]` : "";

        return `- #${bar.details.mappedId} ${title} [${bar.state.badge}|${bar.state.color}]${halfOpenMarker}`;
      })
    : ["- none"];

  const barDetails = timeline.bars.length
    ? timeline.bars.map((bar) => `- #${bar.workItemId} mappedId=${bar.details.mappedId}`)
    : ["- none"];

  const unschedulable = timeline.unschedulable.length
    ? timeline.unschedulable.map((item) => {
        const title = truncateTitle(item.title);
        return `- ${title} [${item.state.badge}|${item.state.color}]`;
      })
    : ["- none"];

  const unschedulableDetails = timeline.unschedulable.length
    ? timeline.unschedulable.map((item) => `- #${item.workItemId} mappedId=${item.details.mappedId}`)
    : ["- none"];

  const dependencyToggle = `Dependency arrows: ${showDependencies ? "shown" : "hidden"}`;
  const dependencyLines = showDependencies
    ? timeline.dependencies.length
      ? timeline.dependencies.map((arrow) => `- ${arrow.label}`)
      : ["- none"]
    : ["- hidden by toggle"];

  const suppressedDependencies = timeline.suppressedDependencies.length
    ? timeline.suppressedDependencies.map(
        (dependency) =>
          `- #${dependency.predecessorWorkItemId} -> #${dependency.successorWorkItemId} (${dependency.reason})`
      )
    : ["- none"];

  return [
    "Timeline bars (title + state):",
    ...bars,
    "Timeline details (mapped ID):",
    ...barDetails,
    "Unschedulable items (title + state):",
    ...unschedulable,
    "Unschedulable details (mapped ID):",
    ...unschedulableDetails,
    dependencyToggle,
    "Dependencies (FS arrows: predecessor end -> successor start):",
    ...dependencyLines,
    "Suppressed dependencies (details only):",
    ...suppressedDependencies
  ];
}

function truncateTitle(title: string): string {
  if (title.length <= MAX_PRIMARY_TITLE_LENGTH) {
    return title;
  }

  return `${title.slice(0, MAX_PRIMARY_TITLE_LENGTH - 1)}…`;
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
