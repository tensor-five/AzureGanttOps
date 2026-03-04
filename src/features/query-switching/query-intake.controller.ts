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

    let context;

    try {
      context = parseQueryInput(request.queryInput, defaults ?? undefined);
    } catch (error: unknown) {
      const guidance = toUserMessage(error, "Paste a valid Azure DevOps query URL or query ID.");
      const trustState = "needs_attention" as const;
      const model = this.toViewModel({
        success: false,
        guidance,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId: null,
        lastRefreshAt: null,
        reloadSource: null,
        trustState,
        savedQueries: [],
        selectedQueryId: null,
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        showDependencies: true
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
      const result = await this.runQueryIntake.execute({ context });
      const runtimeGuidance = result.snapshot ? null : guidanceForRuntimeState(result.reload.source);
      const timelineGuidance = result.timeline && result.timeline.mappingValidation.status === "invalid"
        ? guidanceForMappingIssues(result.timeline.mappingValidation.issues)
        : null;

      const guidance = guidanceForPreflight(result.preflight.status) ?? runtimeGuidance ?? timelineGuidance ?? guidanceForSnapshot(result.snapshot);
      const success = result.preflight.status === "READY" && result.snapshot !== null && result.timeline !== null && result.timeline.mappingValidation.status === "valid";
      const workItemIds = result.snapshot?.workItemIds ?? [];
      const relations = result.snapshot?.relations ?? [];
      const trustState = determineTrustState(success, result.snapshot);
      const mappingValidation = result.timeline?.mappingValidation ?? {
        status: "invalid" as const,
        issues: []
      };
      const model = this.toViewModel({
        success,
        guidance,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId: result.reload.activeQueryId,
        lastRefreshAt: result.reload.lastRefreshAt,
        reloadSource: result.reload.source,
        trustState,
        savedQueries: result.savedQueries,
        selectedQueryId: result.selectedQueryId,
        timeline: result.timeline,
        mappingValidation,
        showDependencies: true
      });

      return {
        success,
        guidance,
        preflightStatus: result.preflight.status,
        selectedQueryId: result.selectedQueryId,
        activeQueryId: result.reload.activeQueryId,
        lastRefreshAt: result.reload.lastRefreshAt,
        reloadSource: result.reload.source,
        trustState,
        savedQueries: result.savedQueries,
        workItemIds,
        relations,
        timeline: result.timeline,
        mappingValidation,
        activeMappingProfileId: result.activeMappingProfileId,
        view: renderQueryIntakeView(model)
      };
    } catch (error: unknown) {
      const guidance = guidanceForRuntimeError(error);
      const trustState = "needs_attention" as const;
      const model = this.toViewModel({
        success: false,
        guidance,
        flatQuerySupportNote: FLAT_ONLY_NOTE,
        activeQueryId: context.queryId.value,
        lastRefreshAt: null,
        reloadSource: "full_reload",
        trustState,
        savedQueries: [],
        selectedQueryId: context.queryId.value,
        timeline: null,
        mappingValidation: {
          status: "invalid",
          issues: []
        },
        showDependencies: true
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
