import type { AdoContextStore } from "../../app/config/ado-context.store.js";
import type { RunQueryIntakeUseCase } from "../../application/use-cases/run-query-intake.use-case.js";
import { parseQueryInput } from "../../domain/query-runtime/services/query-input-parser.js";
import {
  buildFsArrows,
  renderQueryIntakeView,
  type QueryIntakeViewModel
} from "./query-intake.view.js";

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
  fsArrows: {
    predecessorId: number;
    successorId: number;
    label: string;
  }[];
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
      const model = this.toViewModel({
        success: false,
        guidance,
        savedQueries: [],
        selectedQueryId: null,
        workItemIds: [],
        relations: []
      });

      return {
        success: false,
        guidance,
        preflightStatus: "UNKNOWN_ERROR",
        selectedQueryId: null,
        savedQueries: [],
        workItemIds: [],
        relations: [],
        fsArrows: [],
        view: renderQueryIntakeView(model)
      };
    }

    await this.contextStore.setActiveContext({
      organization: context.organization,
      project: context.project
    });

    try {
      const result = await this.runQueryIntake.execute({ context });
      const guidance = guidanceForPreflight(result.preflight.status);
      const success = result.preflight.status === "READY" && result.snapshot !== null;
      const workItemIds = result.snapshot?.workItemIds ?? [];
      const relations = result.snapshot?.relations ?? [];
      const model = this.toViewModel({
        success,
        guidance,
        savedQueries: result.savedQueries,
        selectedQueryId: result.selectedQueryId,
        workItemIds,
        relations
      });

      return {
        success,
        guidance,
        preflightStatus: result.preflight.status,
        selectedQueryId: result.selectedQueryId,
        savedQueries: result.savedQueries,
        workItemIds,
        relations,
        fsArrows: buildFsArrows(relations),
        view: renderQueryIntakeView(model)
      };
    } catch (error: unknown) {
      const guidance = guidanceForRuntimeError(error);
      const model = this.toViewModel({
        success: false,
        guidance,
        savedQueries: [],
        selectedQueryId: context.queryId.value,
        workItemIds: [],
        relations: []
      });

      return {
        success: false,
        guidance,
        preflightStatus: "READY",
        selectedQueryId: context.queryId.value,
        savedQueries: [],
        workItemIds: [],
        relations: [],
        fsArrows: [],
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
    case "CONTEXT_REQUIRED":
      return "Add organization and project in settings.";
    case "MALFORMED_PAYLOAD":
      return "Unexpected Azure response. Retry shortly.";
    default:
      return "Unable to load query results. Retry in a moment.";
  }
}

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
