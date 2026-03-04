import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { TimelineReadModel } from "../dto/timeline-read-model.js";
import type { AuthPreflightPort, AuthPreflightResult } from "../ports/auth-preflight.port.js";
import type { AdoContext } from "../ports/context-settings.port.js";
import type { MappingSettingsPort } from "../ports/mapping-settings.port.js";
import type { QueryRuntimePort, SavedQuery } from "../ports/query-runtime.port.js";
import type { BuildTimelineViewUseCase } from "./build-timeline-view.use-case.js";
import type { QueryContext } from "../../domain/query-runtime/entities/query-context.js";
import type { FieldMappingProfile, RequiredMappingField } from "../../domain/mapping/field-mapping.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";

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
  timeline: TimelineReadModel | null;
  activeMappingProfileId: string | null;
};

export class RunQueryIntakeUseCase {
  private latestRunVersion = 0;
  private latestSelectedQueryId = "";
  private mappingInitialized = false;

  public constructor(
    private readonly authPreflight: AuthPreflightPort,
    private readonly queryRuntime: QueryRuntimePort,
    private readonly buildTimelineView: BuildTimelineViewUseCase | null = null,
    private readonly mappingSettings: MappingSettingsPort | null = null,
    private activeMappingProfile: FieldMappingProfile | null = null
  ) {}

  public async execute(input: RunQueryIntakeInput): Promise<RunQueryIntakeResult> {
    await this.initializeMappingProfile();

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
        reload: this.currentMetadata(runVersion, "preflight_blocked"),
        timeline: null,
        activeMappingProfileId: this.activeMappingProfile?.id ?? null
      };
    }

    const savedQueries = await this.queryRuntime.listSavedQueries(context);
    const snapshot = await this.queryRuntime.executeByQueryId(selectedQueryId, context);
    const stale = this.isStale(runVersion);

    return {
      preflight,
      savedQueries,
      selectedQueryId,
      snapshot: stale ? null : snapshot,
      reload: this.currentMetadata(runVersion, stale ? "stale_discarded" : "full_reload"),
      timeline: stale ? null : this.buildTimeline(snapshot),
      activeMappingProfileId: this.activeMappingProfile?.id ?? null
    };
  }

  private async initializeMappingProfile(): Promise<void> {
    if (this.mappingInitialized) {
      return;
    }

    this.mappingInitialized = true;

    if (!this.mappingSettings || this.activeMappingProfile) {
      return;
    }

    const [profiles, lastActiveProfileId] = await Promise.all([
      this.mappingSettings.loadProfiles(),
      this.mappingSettings.getLastActiveProfileId()
    ]);

    if (!lastActiveProfileId) {
      this.activeMappingProfile = null;
      return;
    }

    this.activeMappingProfile = profiles.find((profile) => profile.id === lastActiveProfileId) ?? null;
  }

  private buildTimeline(snapshot: IngestionSnapshot): TimelineReadModel | null {
    if (!this.buildTimelineView) {
      return null;
    }

    if (!this.activeMappingProfile) {
      return createMissingMappingValidationResult();
    }

    return this.buildTimelineView.execute({
      snapshot,
      mappingProfile: this.activeMappingProfile
    });
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

function createMissingMappingValidationResult(): TimelineReadModel {
  const requiredFields: RequiredMappingField[] = ["id", "title", "start", "endOrTarget"];
  const fieldLabels: Record<RequiredMappingField, string> = {
    id: "ID",
    title: "Title",
    start: "Start Date",
    endOrTarget: "End/Target Date"
  };

  const issues: MappingValidationIssue[] = requiredFields.map((field) => ({
    code: "MAP_REQUIRED_MISSING",
    field,
    message: `${fieldLabels[field]} mapping is required.`,
    guidance: `Assign an Azure field reference for ${fieldLabels[field]}.`
  }));

  return {
    bars: [],
    unschedulable: [],
    dependencies: [],
    suppressedDependencies: [],
    mappingValidation: {
      status: "invalid",
      issues
    }
  };
}
