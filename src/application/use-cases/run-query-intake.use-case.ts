import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { AuthPreflightPort, AuthPreflightResult } from "../ports/auth-preflight.port.js";
import type { AdoContext } from "../ports/context-settings.port.js";
import type { QueryRuntimePort, SavedQuery } from "../ports/query-runtime.port.js";
import type { QueryContext } from "../../domain/query-runtime/entities/query-context.js";

export type RunQueryIntakeInput = {
  context: QueryContext;
};

export type RunQueryIntakeResult = {
  preflight: AuthPreflightResult;
  savedQueries: SavedQuery[];
  selectedQueryId: string;
  snapshot: IngestionSnapshot | null;
};

export class RunQueryIntakeUseCase {
  public constructor(
    private readonly authPreflight: AuthPreflightPort,
    private readonly queryRuntime: QueryRuntimePort
  ) {}

  public async execute(input: RunQueryIntakeInput): Promise<RunQueryIntakeResult> {
    const context = toAdoContext(input.context);
    const preflight = await this.authPreflight.check(context);

    if (preflight.status !== "READY") {
      return {
        preflight,
        savedQueries: [],
        selectedQueryId: input.context.queryId.value,
        snapshot: null
      };
    }

    const savedQueries = await this.queryRuntime.listSavedQueries(context);
    const selectedQueryId = input.context.queryId.value;

    const snapshot = await this.queryRuntime.executeByQueryId(selectedQueryId, context);

    return {
      preflight,
      savedQueries,
      selectedQueryId,
      snapshot
    };
  }
}

function toAdoContext(context: QueryContext): AdoContext {
  return {
    organization: context.organization,
    project: context.project
  };
}
