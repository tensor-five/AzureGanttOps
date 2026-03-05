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

export type QueryIntakeRequest = {
  queryInput: string;
  showDependencies?: boolean;
  dismissStrictFailWarning?: boolean;
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
    private readonly runQueryIntake: RunQueryIntakeUseCase
  ) {}

  public async submit(request: QueryIntakeRequest): Promise<QueryIntakeResponse> {
    const defaults = await this.contextStore.getActiveContext();
    const showDependencies = request.showDependencies ?? true;

    let context;

    try {
      context = parseQueryInput(request.queryInput, defaults ?? undefined);
    } catch (error: unknown) {
      const guidance = toUserMessage(error, "Paste a valid Azure DevOps query URL or query ID.");
      const trustState = "needs_attention" as const;
      const strictFail = noStrictFailState(request.dismissStrictFailWarning);
      const model = this.toViewModel({
        success: false,
        guidance,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId: null,
        lastRefreshAt: null,
        reloadSource: null,
        trustState,
        strictFail,
        savedQueries: [],
        selectedQueryId: null,
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        showDependencies
      });
      return {
        success: false,
        guidance,
        preflightStatus: "UNKNOWN_ERROR",
        selectedQueryId: null,
        activeQueryId: null,
        lastRefreshAt: null,
        reloadSource: null,
        trustState,
        strictFail,
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

      const effectiveSnapshot = canUseStrictFailFallback ? result.lastKnownGood.snapshot : result.snapshot;
      const effectiveTimeline = canUseStrictFailFallback ? result.lastKnownGood.timeline : result.timeline;
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

      const trustState = canUseStrictFailFallback
        ? "needs_attention"
        : determineTrustState(effectiveSuccess, effectiveSnapshot);

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

      const model = this.toViewModel({
        success: effectiveSuccess,
        guidance,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId,
        lastRefreshAt,
        reloadSource: result.reload.source,
        trustState,
        strictFail,
        savedQueries: result.savedQueries,
        selectedQueryId: result.selectedQueryId,
        timeline: effectiveTimeline,
        mappingValidation: effectiveMappingValidation,
        showDependencies
      });

      return {
        success: effectiveSuccess,
        guidance,
        preflightStatus: result.preflight.status,
        selectedQueryId: result.selectedQueryId,
        activeQueryId,
        lastRefreshAt,
        reloadSource: result.reload.source,
        trustState,
        strictFail,
        savedQueries: result.savedQueries,
        workItemIds: effectiveSnapshot?.workItemIds ?? [],
        relations: effectiveSnapshot?.relations ?? [],
        timeline: effectiveTimeline,
        mappingValidation: effectiveMappingValidation,
        activeMappingProfileId,
        view: renderQueryIntakeView(model)
      };
    } catch (error: unknown) {
      const guidance = guidanceForRuntimeError(error);
      const trustState = "needs_attention" as const;
      const strictFail = noStrictFailState(request.dismissStrictFailWarning);
      const model = this.toViewModel({
        success: false,
        guidance,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId: context.queryId.value,
        lastRefreshAt: null,
        reloadSource: "full_reload",
        trustState,
        strictFail,
        savedQueries: [],
        selectedQueryId: context.queryId.value,
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        showDependencies
      });

      return {
        success: false,
        guidance,
        preflightStatus: "READY",
        selectedQueryId: context.queryId.value,
        activeQueryId: context.queryId.value,
        lastRefreshAt: null,
        reloadSource: "full_reload",
        trustState,
        strictFail,
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
    case "QUERY_EXECUTION_FAILED":
      return "Query failed to run. Retry or verify query permissions.";
    case "QRY_SHAPE_UNSUPPORTED":
      return "Only flat queries are supported in this phase. Use a flat query and retry.";
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

function determineTrustState(
  success: boolean,
  snapshot: { hydration: { statusCode: string } } | null
): "ready" | "needs_attention" | "partial_failure" {
  if (!success) {
    return "needs_attention";
  }

  if (snapshot?.hydration.statusCode === "HYDRATION_PARTIAL_FAILURE") {
    return "partial_failure";
  }

  return "ready";
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
