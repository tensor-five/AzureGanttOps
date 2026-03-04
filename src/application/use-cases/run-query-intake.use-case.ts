import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { AuthPreflightPort, AuthPreflightResult } from "../ports/auth-preflight.port.js";
import type { AdoContext } from "../ports/context-settings.port.js";
import type { QueryRuntimePort, SavedQuery } from "../ports/query-runtime.port.js";
import type { QueryContext } from "../../domain/query-runtime/entities/query-context.js";

export type RunQueryIntakeInput = {
  context: QueryContext;
};

export type QueryReloadSource = "full_reload" | "preflight_blocked" | "stale_discarded";

export type QueryReloadMetadata = {
  runVersion: number;
  stale: boolean;
  activeQueryId: string;
  lastRefreshAt: string | null;
  source: QueryReloadSource;
};

export type RunQueryIntakeResult = {
  preflight: AuthPreflightResult;
  savedQueries: SavedQuery[];
  selectedQueryId: string;
  snapshot: IngestionSnapshot | null;
  reload: QueryReloadMetadata;
};

export class RunQueryIntakeUseCase {
  private latestRunVersion = 0;
  private latestSelectedQueryId = "";

  public constructor(
    private readonly authPreflight: AuthPreflightPort,
    private readonly queryRuntime: QueryRuntimePort
  ) {}

  public async execute(input: RunQueryIntakeInput): Promise<RunQueryIntakeResult> {
    const context = toAdoContext(input.context);
    const selectedQueryId = input.context.queryId.value;
    const runVersion = this.startRun(selectedQueryId);
    const preflight = await this.authPreflight.check(context);

    if (preflight.status !== "READY") {
      return {
        preflight,
        savedQueries: [],
        selectedQueryId,
        snapshot: null,
        reload: this.currentMetadata(runVersion, "preflight_blocked")
      };
    }

    const savedQueries = await this.queryRuntime.listSavedQueries(context);
    const snapshot = await this.queryRuntime.executeByQueryId(selectedQueryId, context);

    return {
      preflight,
      savedQueries,
      selectedQueryId,
      snapshot: this.isStale(runVersion) ? null : snapshot,
      reload: this.currentMetadata(runVersion, this.isStale(runVersion) ? "stale_discarded" : "full_reload")
    };
  }

  private startRun(selectedQueryId: string): number {
    this.latestRunVersion += 1;
    this.latestSelectedQueryId = selectedQueryId;
    return this.latestRunVersion;
  }

  private isStale(runVersion: number): boolean {
    return runVersion !== this.latestRunVersion;
  }

  private currentMetadata(runVersion: number, source: QueryReloadSource): QueryReloadMetadata {
    const stale = this.isStale(runVersion);

    return {
      runVersion,
      stale,
      activeQueryId: this.latestSelectedQueryId,
      lastRefreshAt: stale || source === "preflight_blocked" ? null : new Date().toISOString(),
      source
    };
  }
}

function toAdoContext(context: QueryContext): AdoContext {
  return {
    organization: context.organization,
    project: context.project
  };
}
