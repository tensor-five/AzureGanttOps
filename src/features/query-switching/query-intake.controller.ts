import type { AdoContextStore } from "../../app/config/ado-context.store.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { RunQueryIntakeUseCase } from "../../application/use-cases/run-query-intake.use-case.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";
import { parseQueryInput } from "../../domain/query-runtime/services/query-input-parser.js";
import {
  renderQueryIntakeView,
  type QueryIntakeViewModel
} from "./query-intake.view.js";
import type { QueryReloadSource } from "../../application/use-cases/run-query-intake.use-case.js";
import { deriveTimelineUiState, type TimelineUiState } from "./timeline-trust-state.js";
import type {
  DiagnosticsErrorCode,
  DiagnosticsStatusCode
} from "../../application/dto/diagnostics/diagnostics-event.dto.js";
import type { PublishDiagnosticsUseCase } from "../../application/use-cases/publish-diagnostics.use-case.js";

export type QueryIntakeRequest = {
  queryInput: string;
  showDependencies?: boolean;
  dismissStrictFailWarning?: boolean;
  density?: "comfortable" | "compact";
  mappingProfileId?: string | null;
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
};

export type QueryIntakeResponse = {
  success: boolean;
  guidance: string | null;
  statusCode: DiagnosticsStatusCode;
  errorCode: DiagnosticsErrorCode | null;
  preflightStatus:
    | "READY"
    | "SESSION_EXPIRED"
    | "MISSING_EXTENSION"
    | "CONTEXT_MISMATCH"
    | "CLI_NOT_FOUND"
    | "UNKNOWN_ERROR";
  selectedQueryId: string | null;
  activeQueryId: string | null;
  lastRefreshAt: string | null;
  reloadSource: QueryReloadSource | null;
  uiState: TimelineUiState;
  trustState: "ready" | "needs_attention" | "partial_failure";
  strictFail: {
    active: boolean;
    message: string | null;
    retryActionLabel: string | null;
    dismissible: boolean;
    dismissed: boolean;
    lastSuccessfulRefreshAt: string | null;
    lastSuccessfulSource: QueryReloadSource | null;
  };
  capabilities: {
    canRefresh: boolean;
    canSwitchQuery: boolean;
    canChangeDensity: boolean;
    canOpenDetails: boolean;
    readOnlyTimeline: boolean;
  };
  density: "comfortable" | "compact";
  savedQueries: {
    id: string;
    name: string;
    path: string;
  }[];
  workItemIds: number[];
  relations: {
    type:
      | "System.LinkTypes.Dependency-Forward"
      | "System.LinkTypes.Dependency-Reverse"
      | "System.LinkTypes.Hierarchy-Forward"
      | "System.LinkTypes.Hierarchy-Reverse";
    sourceId: number;
    targetId: number;
  }[];
  timeline: TimelineReadModel | null;
  mappingValidation: {
    status: "valid" | "invalid";
    issues: MappingValidationIssue[];
  };
  activeMappingProfileId: string | null;
  view: string;
};

export class QueryIntakeController {
  public constructor(
    private readonly contextStore: AdoContextStore,
    private readonly runQueryIntake: RunQueryIntakeUseCase,
    private readonly publishDiagnostics: PublishDiagnosticsUseCase | null = null
  ) {}

  private async emitDiagnostics(input: {
    statusCode: DiagnosticsStatusCode;
    errorCode: DiagnosticsErrorCode | null;
    guidance: string;
    preflightStatus: QueryIntakeResponse["preflightStatus"];
    uiState: TimelineUiState;
    trustState: QueryIntakeResponse["trustState"];
    activeQueryId: string | null;
    selectedQueryId: string | null;
    reloadSource: QueryReloadSource | null;
    lastRefreshAt: string | null;
    lastSuccessfulRefreshAt: string | null;
    metadata?: Readonly<Record<string, string | number | boolean | null>>;
  }): Promise<void> {
    if (!this.publishDiagnostics) {
      return;
    }

    await this.publishDiagnostics.execute({
      eventName: "query-intake.outcome",
      timestamp: new Date().toISOString(),
      statusCode: input.statusCode,
      errorCode: input.errorCode,
      guidance: input.guidance,
      source: {
        component: "query-intake",
        preflightStatus: input.preflightStatus,
        uiState: input.uiState,
        trustState: input.trustState,
        activeQueryId: input.activeQueryId,
        selectedQueryId: input.selectedQueryId,
        reloadSource: input.reloadSource
      },
      freshness: {
        lastRefreshAt: input.lastRefreshAt,
        lastSuccessfulRefreshAt: input.lastSuccessfulRefreshAt
      },
      metadata: input.metadata
    });
  }

  public async submit(request: QueryIntakeRequest): Promise<QueryIntakeResponse> {
    const defaults = await this.contextStore.getActiveContext();
    const showDependencies = request.showDependencies ?? true;
    const density = request.density ?? "comfortable";

    let context;

    try {
      context = parseQueryInput(request.queryInput, defaults ?? undefined);
    } catch (error: unknown) {
      const guidance = toUserMessage(error, "Paste a valid Azure DevOps query URL or query ID.");
      const uiState = "query_failure" as const;
      const trustState = "needs_attention" as const;
      const strictFail = noStrictFailState(request.dismissStrictFailWarning);
      const capabilities = buildCapabilities("UNKNOWN_ERROR");
      const model = this.toViewModel({
        success: false,
        guidance,
        statusCode: "UNKNOWN_ERROR",
        errorCode: "UNKNOWN_ERROR",
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId: null,
        lastRefreshAt: null,
        reloadSource: null,
        uiState,
        trustState,
        strictFail,
        capabilities,
        density,
        savedQueries: [],
        selectedQueryId: null,
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        showDependencies
      });
      const response: QueryIntakeResponse = {
        success: false,
        guidance,
        statusCode: "UNKNOWN_ERROR",
        errorCode: "UNKNOWN_ERROR",
        preflightStatus: "UNKNOWN_ERROR",
        selectedQueryId: null,
        activeQueryId: null,
        lastRefreshAt: null,
        reloadSource: null,
        uiState,
        trustState,
        strictFail,
        capabilities,
        density,
        savedQueries: [],
        workItemIds: [],
        relations: [],
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        activeMappingProfileId: null,
        view: renderQueryIntakeView(model)
      };

      await this.emitDiagnostics({
        statusCode: "UNKNOWN_ERROR",
        errorCode: "UNKNOWN_ERROR",
        guidance,
        preflightStatus: response.preflightStatus,
        uiState: response.uiState,
        trustState: response.trustState,
        activeQueryId: response.activeQueryId,
        selectedQueryId: response.selectedQueryId,
        reloadSource: response.reloadSource,
        lastRefreshAt: response.lastRefreshAt,
        lastSuccessfulRefreshAt: response.strictFail.lastSuccessfulRefreshAt,
        metadata: {
          strictFailActive: response.strictFail.active
        }
      });

      return response;
    }

    await this.contextStore.setActiveContext({
      organization: context.organization,
      project: context.project
    });

    try {
      const result = await this.runQueryIntake.execute({
        context,
        mappingMutation: {
          selectProfileId: request.mappingProfileId,
          upsertProfile: request.mappingProfileUpsert
        }
      });

      const runtimeGuidance = result.snapshot ? null : guidanceForRuntimeState(result.reload.source);
      const timelineGuidance = result.timeline && result.timeline.mappingValidation.status === "invalid"
        ? guidanceForMappingIssues(result.timeline.mappingValidation.issues)
        : null;

      const initialGuidance =
        guidanceForPreflight(result.preflight.status) ??
        runtimeGuidance ??
        timelineGuidance ??
        guidanceForSnapshot(result.snapshot);

      const initialSuccess =
        result.preflight.status === "READY" &&
        result.snapshot !== null &&
        result.timeline !== null &&
        result.timeline.mappingValidation.status === "valid";

      const canUseStrictFailFallback =
        !initialSuccess &&
        result.lastKnownGood != null &&
        result.lastSuccessfulReload != null;

      const fallbackPayload = canUseStrictFailFallback ? result.lastKnownGood : null;
      const effectiveSnapshot = fallbackPayload ? fallbackPayload.snapshot : result.snapshot;
      const effectiveTimeline = fallbackPayload ? fallbackPayload.timeline : result.timeline;
      const effectiveMappingValidation =
        effectiveTimeline?.mappingValidation ?? {
          status: "invalid" as const,
          issues: []
        };

      const effectiveSuccess =
        canUseStrictFailFallback ||
        (result.preflight.status === "READY" &&
          effectiveSnapshot !== null &&
          effectiveTimeline !== null &&
          effectiveMappingValidation.status === "valid");

      const strictFail = canUseStrictFailFallback
        ? {
            active: true,
            message: strictFailMessage(result.failureCode, result.lastSuccessfulReload?.lastRefreshAt ?? null),
            retryActionLabel: "Retry now",
            dismissible: true,
            dismissed: request.dismissStrictFailWarning ?? false,
            lastSuccessfulRefreshAt: result.lastSuccessfulReload?.lastRefreshAt ?? null,
            lastSuccessfulSource: result.lastSuccessfulReload?.source ?? null
          }
        : noStrictFailState(request.dismissStrictFailWarning);

      const guidance = canUseStrictFailFallback
        ? strictFail.message
        : initialGuidance;

      const activeQueryId = canUseStrictFailFallback
        ? result.lastSuccessfulReload?.activeQueryId ?? result.reload.activeQueryId
        : result.reload.activeQueryId;

      const lastRefreshAt = canUseStrictFailFallback
        ? result.lastSuccessfulReload?.lastRefreshAt ?? null
        : result.reload.lastRefreshAt;

      const activeMappingProfileId = canUseStrictFailFallback
        ? result.lastKnownGood?.activeMappingProfileId ?? result.activeMappingProfileId
        : result.activeMappingProfileId;

      const hasAnyItems = hasRenderableItems(effectiveTimeline);
      const uiState = deriveTimelineUiState({
        preflightStatus: result.preflight.status,
        hasTimeline: effectiveTimeline !== null,
        hasAnyItems,
        hydrationStatusCode: effectiveSnapshot?.hydration.statusCode ?? null,
        hasStrictFailFallback: strictFail.active,
        hasQueryFailure: !effectiveSuccess && result.failureCode !== null
      });

      const trustState = toTrustState(uiState);
      const capabilities = buildCapabilities(result.preflight.status);

      const statusCode = deriveDiagnosticsStatusCodeFromResult({
        preflightStatus: result.preflight.status,
        strictFailActive: strictFail.active,
        reloadSource: result.reload.source,
        failureCode: result.failureCode,
        uiState
      });
      const errorCode = toDiagnosticsErrorCode(result.failureCode);
      const model = this.toViewModel({
        success: effectiveSuccess,
        guidance,
        statusCode,
        errorCode,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId,
        lastRefreshAt,
        reloadSource: result.reload.source,
        uiState,
        trustState,
        strictFail,
        capabilities,
        density,
        savedQueries: result.savedQueries,
        selectedQueryId: result.selectedQueryId,
        timeline: effectiveTimeline,
        mappingValidation: effectiveMappingValidation,
        showDependencies
      });

      const response: QueryIntakeResponse = {
        success: effectiveSuccess,
        guidance,
        statusCode,
        errorCode,
        preflightStatus: result.preflight.status,
        selectedQueryId: result.selectedQueryId,
        activeQueryId,
        lastRefreshAt,
        reloadSource: result.reload.source,
        uiState,
        trustState,
        strictFail,
        capabilities,
        density,
        savedQueries: result.savedQueries,
        workItemIds: effectiveSnapshot?.workItemIds ?? [],
        relations: effectiveSnapshot?.relations ?? [],
        timeline: effectiveTimeline,
        mappingValidation: effectiveMappingValidation,
        activeMappingProfileId,
        view: renderQueryIntakeView(model)
      };

      await this.emitDiagnostics({
        statusCode: response.statusCode,
        errorCode: response.errorCode,
        guidance: response.guidance ?? "Action: none",
        preflightStatus: response.preflightStatus,
        uiState: response.uiState,
        trustState: response.trustState,
        activeQueryId: response.activeQueryId,
        selectedQueryId: response.selectedQueryId,
        reloadSource: response.reloadSource,
        lastRefreshAt: response.lastRefreshAt,
        lastSuccessfulRefreshAt: response.strictFail.lastSuccessfulRefreshAt,
        metadata: {
          strictFailActive: response.strictFail.active,
          runVersion: result.reload.runVersion
        }
      });

      return response;
    } catch (error: unknown) {
      const guidance = guidanceForRuntimeError(error);
      const preflightStatus = "READY" as const;
      const uiState = deriveTimelineUiState({
        preflightStatus,
        hasTimeline: false,
        hasAnyItems: false,
        hydrationStatusCode: null,
        hasStrictFailFallback: false,
        hasQueryFailure: true
      });
      const trustState = toTrustState(uiState);
      const strictFail = noStrictFailState(request.dismissStrictFailWarning);
      const capabilities = buildCapabilities(preflightStatus);
      const statusCode = toDiagnosticsStatusCode(toErrorCode(error));
      const errorCode = toDiagnosticsErrorCode(toErrorCode(error));
      const model = this.toViewModel({
        success: false,
        guidance,
        statusCode,
        errorCode,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId: context.queryId.value,
        lastRefreshAt: null,
        reloadSource: "full_reload",
        uiState,
        trustState,
        strictFail,
        capabilities,
        density,
        savedQueries: [],
        selectedQueryId: context.queryId.value,
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        showDependencies
      });

      const response: QueryIntakeResponse = {
        success: false,
        guidance,
        statusCode,
        errorCode,
        preflightStatus,
        selectedQueryId: context.queryId.value,
        activeQueryId: context.queryId.value,
        lastRefreshAt: null,
        reloadSource: "full_reload",
        uiState,
        trustState,
        strictFail,
        capabilities,
        density,
        savedQueries: [],
        workItemIds: [],
        relations: [],
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        activeMappingProfileId: null,
        view: renderQueryIntakeView(model)
      };

      await this.emitDiagnostics({
        statusCode: response.statusCode,
        errorCode: response.errorCode,
        guidance,
        preflightStatus: response.preflightStatus,
        uiState: response.uiState,
        trustState: response.trustState,
        activeQueryId: response.activeQueryId,
        selectedQueryId: response.selectedQueryId,
        reloadSource: response.reloadSource,
        lastRefreshAt: response.lastRefreshAt,
        lastSuccessfulRefreshAt: response.strictFail.lastSuccessfulRefreshAt,
        metadata: {
          strictFailActive: response.strictFail.active
        }
      });

      return response;
    }
  }

  private toViewModel(input: QueryIntakeViewModel): QueryIntakeViewModel {
    return input;
  }
}

function guidanceForPreflight(status: QueryIntakeResponse["preflightStatus"]): string | null {
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
      return "Azure CLI is not available. Install Azure CLI and retry.";
    case "UNKNOWN_ERROR":
    default:
      return "Could not validate Azure connection. Retry in a moment.";
  }
}

function guidanceForRuntimeError(error: unknown): string {
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

function guidanceForSnapshot(snapshot: { hydration: { statusCode: string } } | null): string | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.hydration.statusCode === "HYDRATION_PARTIAL_FAILURE") {
    return "Some work items could not be hydrated. Retry to improve completeness.";
  }

  return null;
}

function guidanceForRuntimeState(source: QueryReloadSource): string | null {
  if (source === "stale_discarded") {
    return "Stale reload was discarded after query switch.";
  }

  return null;
}

function guidanceForMappingIssues(issues: MappingValidationIssue[]): string {
  if (issues.length === 0) {
    return "Mapping profile is invalid. Fix required mappings and retry.";
  }

  const guidanceSteps = issues.map((issue) => `${issue.field}: ${issue.guidance}`);
  return `Fix required mapping fields before rendering timeline: ${guidanceSteps.join(" | ")}`;
}

function toTrustState(uiState: TimelineUiState): "ready" | "needs_attention" | "partial_failure" {
  if (uiState === "ready") {
    return "ready";
  }

  if (uiState === "partial_failure") {
    return "partial_failure";
  }

  return "needs_attention";
}

function hasRenderableItems(timeline: TimelineReadModel | null): boolean {
  if (!timeline) {
    return false;
  }

  return timeline.bars.length > 0 || timeline.unschedulable.length > 0;
}

function buildCapabilities(
  preflightStatus: QueryIntakeResponse["preflightStatus"]
): QueryIntakeResponse["capabilities"] {
  const hasActiveSession = preflightStatus === "READY";

  return {
    canRefresh: hasActiveSession,
    canSwitchQuery: hasActiveSession,
    canChangeDensity: true,
    canOpenDetails: true,
    readOnlyTimeline: true
  };
}

function noStrictFailState(dismissed: boolean | undefined): QueryIntakeResponse["strictFail"] {
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

function strictFailMessage(failureCode: string | null, lastSuccessfulRefreshAt: string | null): string {
  const failureContext = failureCode ? `Refresh failed (${failureCode}).` : "Refresh failed.";
  const freshnessContext = lastSuccessfulRefreshAt
    ? `Showing last successful timeline from ${lastSuccessfulRefreshAt}.`
    : "Showing last successful timeline.";

  return `${failureContext} ${freshnessContext} Retry now.`;
}

const FLAT_ONLY_NOTE = "Phase 2 note: only flat queries are supported.";

function toErrorCode(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "UNKNOWN";
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function deriveDiagnosticsStatusCodeFromResult(input: {
  preflightStatus: QueryIntakeResponse["preflightStatus"];
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

function toDiagnosticsErrorCode(code: string | null): DiagnosticsErrorCode | null {
  if (!code) {
    return null;
  }

  const statusCode = toDiagnosticsStatusCode(code);
  return statusCode === "OK" ? null : statusCode;
}

function toDiagnosticsStatusCode(code: string): DiagnosticsStatusCode {
  const deterministicCodes: ReadonlySet<DiagnosticsStatusCode> = new Set<DiagnosticsStatusCode>([
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

  return deterministicCodes.has(code as DiagnosticsStatusCode)
    ? (code as DiagnosticsStatusCode)
    : "UNKNOWN_ERROR";
}
