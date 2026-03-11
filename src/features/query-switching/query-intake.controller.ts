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
import {
  buildCapabilities,
  deriveDiagnosticsStatusCodeFromResult,
  FLAT_ONLY_NOTE,
  guidanceForMappingIssues,
  guidanceForPreflight,
  guidanceForRuntimeError,
  guidanceForRuntimeState,
  guidanceForSnapshot,
  hasRenderableItems,
  noStrictFailState,
  strictFailMessage,
  toDiagnosticsErrorCode,
  toDiagnosticsStatusCode,
  toErrorCode,
  toTrustState,
  toUserMessage
} from "./query-intake.controller.mappers.js";
import { buildQueryIntakeDiagnosticsEvent, type QueryIntakeDiagnosticsInput } from "./query-intake.controller.diagnostics.js";
import { buildParseErrorFailureState, buildRuntimeErrorFailureState } from "./query-intake.controller.error-paths.js";

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

  private async emitDiagnostics(input: QueryIntakeDiagnosticsInput): Promise<void> {
    if (!this.publishDiagnostics) {
      return;
    }

    await this.publishDiagnostics.execute(buildQueryIntakeDiagnosticsEvent(input));
  }

  public async submit(request: QueryIntakeRequest): Promise<QueryIntakeResponse> {
    const defaults = await this.contextStore.getActiveContext();
    const showDependencies = request.showDependencies ?? true;
    const density = request.density ?? "comfortable";

    let context;

    try {
      context = parseQueryInput(request.queryInput, defaults ?? undefined);
    } catch (error: unknown) {
      const parseFailure = buildParseErrorFailureState({
        error,
        dismissStrictFailWarning: request.dismissStrictFailWarning
      });
      const model = this.toViewModel({
        success: false,
        guidance: parseFailure.guidance,
        statusCode: parseFailure.statusCode,
        errorCode: parseFailure.errorCode,
        flatQuerySupportNote: parseFailure.flatQuerySupportNote,
        activeQueryId: null,
        lastRefreshAt: null,
        reloadSource: null,
        uiState: parseFailure.uiState,
        trustState: parseFailure.trustState,
        strictFail: parseFailure.strictFail,
        capabilities: parseFailure.capabilities,
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
        guidance: parseFailure.guidance,
        statusCode: parseFailure.statusCode,
        errorCode: parseFailure.errorCode,
        preflightStatus: parseFailure.preflightStatus,
        selectedQueryId: null,
        activeQueryId: null,
        lastRefreshAt: null,
        reloadSource: null,
        uiState: parseFailure.uiState,
        trustState: parseFailure.trustState,
        strictFail: parseFailure.strictFail,
        capabilities: parseFailure.capabilities,
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
        statusCode: parseFailure.statusCode,
        errorCode: parseFailure.errorCode,
        guidance: parseFailure.guidance,
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
      const runtimeFailure = buildRuntimeErrorFailureState({
        error,
        dismissStrictFailWarning: request.dismissStrictFailWarning
      });
      const model = this.toViewModel({
        success: false,
        guidance: runtimeFailure.guidance,
        statusCode: runtimeFailure.statusCode,
        errorCode: runtimeFailure.errorCode,
        flatQuerySupportNote: runtimeFailure.flatQuerySupportNote,
        activeQueryId: context.queryId.value,
        lastRefreshAt: null,
        reloadSource: "full_reload",
        uiState: runtimeFailure.uiState,
        trustState: runtimeFailure.trustState,
        strictFail: runtimeFailure.strictFail,
        capabilities: runtimeFailure.capabilities,
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
        guidance: runtimeFailure.guidance,
        statusCode: runtimeFailure.statusCode,
        errorCode: runtimeFailure.errorCode,
        preflightStatus: runtimeFailure.preflightStatus,
        selectedQueryId: context.queryId.value,
        activeQueryId: context.queryId.value,
        lastRefreshAt: null,
        reloadSource: "full_reload",
        uiState: runtimeFailure.uiState,
        trustState: runtimeFailure.trustState,
        strictFail: runtimeFailure.strictFail,
        capabilities: runtimeFailure.capabilities,
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
        guidance: runtimeFailure.guidance,
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
