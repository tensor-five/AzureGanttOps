import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { TimelineReadModel } from "../dto/timeline-read-model.js";
import type { AuthPreflightPort, AuthPreflightResult } from "../ports/auth-preflight.port.js";
import type { AdoContext } from "../ports/context-settings.port.js";
import type { MappingSettingsPort } from "../ports/mapping-settings.port.js";
import type { QueryRuntimePort, SavedQuery } from "../ports/query-runtime.port.js";
import type { BuildTimelineViewUseCase } from "./build-timeline-view.use-case.js";
import type { QueryContext } from "../../domain/query-runtime/entities/query-context.js";
import {
  type FieldMappingProfile,
  normalizeProfile,
  REQUIRED_FIELD_LABELS,
  REQUIRED_MAPPING_FIELDS,
  type RequiredMappingField
} from "../../domain/mapping/field-mapping.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";
import { validateRequiredMappings } from "../../domain/mapping/mapping-validator.js";
import { proposeDefaultMapping } from "../../domain/mapping/default-mapping-proposal.js";
import { extractAvailableFieldRefs } from "../services/extract-available-field-refs.js";
import { elapsedSince, writePerformanceLog } from "../../shared/telemetry/performance-log.js";

export type RunQueryIntakeInput = {
  context: QueryContext;
  mappingMutation?: {
    selectProfileId?: string | null;
    upsertProfile?: FieldMappingProfile;
  };
};

export type QueryReloadSource = "full_reload" | "preflight_blocked" | "stale_discarded";

export type QueryReloadMetadata = {
  runVersion: number;
  stale: boolean;
  activeQueryId: string;
  lastRefreshAt: string | null;
  source: QueryReloadSource;
};

export type LastSuccessfulReloadMetadata = {
  activeQueryId: string;
  lastRefreshAt: string;
  source: QueryReloadSource;
};

export type LastKnownGoodPayload = {
  selectedQueryId: string;
  snapshot: IngestionSnapshot;
  timeline: TimelineReadModel;
  activeMappingProfileId: string | null;
};

export type RunQueryIntakeResult = {
  preflight: AuthPreflightResult;
  savedQueries: SavedQuery[];
  selectedQueryId: string;
  snapshot: IngestionSnapshot | null;
  reload: QueryReloadMetadata;
  timeline: TimelineReadModel | null;
  activeMappingProfileId: string | null;
  failureCode: string | null;
  lastSuccessfulReload: LastSuccessfulReloadMetadata | null;
  lastKnownGood: LastKnownGoodPayload | null;
};

export class RunQueryIntakeUseCase {
  private latestRunVersion = 0;
  private latestSelectedQueryId = "";
  private mappingInitialized = false;
  private lastSuccessfulReload: LastSuccessfulReloadMetadata | null = null;
  private lastKnownGood: LastKnownGoodPayload | null = null;

  public constructor(
    private readonly authPreflight: AuthPreflightPort,
    private readonly queryRuntime: QueryRuntimePort,
    private readonly buildTimelineView: BuildTimelineViewUseCase | null = null,
    private readonly mappingSettings: MappingSettingsPort | null = null,
    private activeMappingProfile: FieldMappingProfile | null = null
  ) {}

  public async execute(input: RunQueryIntakeInput): Promise<RunQueryIntakeResult> {
    await this.initializeMappingProfile();
    await this.applyMappingMutation(input.mappingMutation);
    const callerProvidedMutation = Boolean(
      input.mappingMutation &&
        (input.mappingMutation.selectProfileId !== undefined ||
          input.mappingMutation.upsertProfile !== undefined)
    );

    const context = toAdoContext(input.context);
    const selectedQueryId = input.context.queryId.value;
    const runVersion = this.startRun(selectedQueryId);
    const runStartedAt = Date.now();

    writePerformanceLog("query-intake", "start", {
      runVersion,
      queryId: selectedQueryId,
      organization: context.organization,
      project: context.project
    });

    const preflightStartedAt = Date.now();
    writePerformanceLog("query-intake", "preflight.start", { runVersion });
    const preflight = await this.authPreflight.check(context);
    writePerformanceLog("query-intake", "preflight.done", {
      runVersion,
      status: preflight.status,
      durationMs: elapsedSince(preflightStartedAt)
    });

    if (preflight.status !== "READY") {
      writePerformanceLog("query-intake", "blocked", {
        runVersion,
        status: preflight.status,
        durationMs: elapsedSince(runStartedAt)
      });
      return this.createResult({
        preflight,
        savedQueries: [],
        selectedQueryId,
        snapshot: null,
        timeline: null,
        reload: this.currentMetadata(runVersion, "preflight_blocked"),
        failureCode: preflight.status
      });
    }

    let savedQueries: SavedQuery[] = [];
    let snapshot: IngestionSnapshot;

    try {
      const runtimeStartedAt = Date.now();
      writePerformanceLog("query-intake", "runtime.start", { runVersion });
      [savedQueries, snapshot] = await Promise.all([
        this.queryRuntime.listSavedQueries(context),
        this.queryRuntime.executeByQueryId(selectedQueryId, context)
      ]);
      writePerformanceLog("query-intake", "runtime.done", {
        runVersion,
        savedQueries: savedQueries.length,
        requestedIds: snapshot.hydration.requestedIds,
        workItems: snapshot.workItems.length,
        batches: snapshot.hydration.attemptedBatches,
        batchSize: snapshot.hydration.maxIdsPerBatch,
        retriedRequests: snapshot.hydration.retriedRequests,
        partial: snapshot.hydration.partial,
        durationMs: elapsedSince(runtimeStartedAt)
      });

      const stale = this.isStale(runVersion);
      if (!stale) {
        const mappingStartedAt = Date.now();
        writePerformanceLog("query-intake", "mapping.start", { runVersion });
        await this.tryAutoApplyMappingFromSnapshot(snapshot, selectedQueryId, callerProvidedMutation);
        writePerformanceLog("query-intake", "mapping.done", {
          runVersion,
          activeMappingProfileId: this.activeMappingProfile?.id ?? null,
          durationMs: elapsedSince(mappingStartedAt)
        });
      }

      const timelineStartedAt = Date.now();
      if (!stale) {
        writePerformanceLog("query-intake", "timeline.start", { runVersion });
      }
      const timeline = stale ? null : await this.buildTimeline(snapshot);
      if (!stale) {
        writePerformanceLog("query-intake", "timeline.done", {
          runVersion,
          bars: timeline?.bars.length ?? 0,
          unschedulable: timeline?.unschedulable.length ?? 0,
          dependencies: timeline?.dependencies.length ?? 0,
          mappingStatus: timeline?.mappingValidation.status ?? null,
          durationMs: elapsedSince(timelineStartedAt)
        });
      }

      const stableSnapshot = stale ? null : snapshot;
      const reload = this.currentMetadata(runVersion, stale ? "stale_discarded" : "full_reload");

      const isSuccessfulCommit =
        preflight.status === "READY" &&
        stableSnapshot !== null &&
        timeline !== null &&
        timeline.mappingValidation.status === "valid" &&
        reload.lastRefreshAt !== null;

      if (isSuccessfulCommit) {
        const successfulRefreshAt = reload.lastRefreshAt;

        if (!successfulRefreshAt) {
          throw new Error("UNKNOWN_ERROR");
        }

        this.lastSuccessfulReload = {
          activeQueryId: selectedQueryId,
          lastRefreshAt: successfulRefreshAt,
          source: reload.source
        };
        this.lastKnownGood = {
          selectedQueryId,
          snapshot: stableSnapshot,
          timeline,
          activeMappingProfileId: this.activeMappingProfile?.id ?? null
        };
      }

      const result = this.createResult({
        preflight,
        savedQueries,
        selectedQueryId,
        snapshot: stableSnapshot,
        timeline,
        reload,
        failureCode: null
      });

      writePerformanceLog("query-intake", "done", {
        runVersion,
        stale,
        success: result.snapshot !== null && result.timeline !== null && result.timeline.mappingValidation.status === "valid",
        durationMs: elapsedSince(runStartedAt)
      });

      return result;
    } catch (error: unknown) {
      const failureCode = toErrorCode(error);
      writePerformanceLog("query-intake", "failed", {
        runVersion,
        failureCode,
        durationMs: elapsedSince(runStartedAt)
      });

      return this.createResult({
        preflight,
        savedQueries,
        selectedQueryId,
        snapshot: null,
        timeline: null,
        reload: this.currentMetadata(runVersion, "full_reload"),
        failureCode
      });
    }
  }

  private createResult(input: {
    preflight: AuthPreflightResult;
    savedQueries: SavedQuery[];
    selectedQueryId: string;
    snapshot: IngestionSnapshot | null;
    timeline: TimelineReadModel | null;
    reload: QueryReloadMetadata;
    failureCode: string | null;
  }): RunQueryIntakeResult {
    return {
      ...input,
      activeMappingProfileId: this.activeMappingProfile?.id ?? null,
      lastSuccessfulReload: this.lastSuccessfulReload,
      lastKnownGood: this.lastKnownGood
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

  private async applyMappingMutation(mutation: RunQueryIntakeInput["mappingMutation"]): Promise<void> {
    if (!mutation || !this.mappingSettings) {
      return;
    }

    if (mutation.upsertProfile) {
      const profile = normalizeProfile(mutation.upsertProfile);
      validateRequiredMappings(profile);

      const profiles = await this.mappingSettings.loadProfiles();
      const existingIndex = profiles.findIndex((entry) => entry.id === profile.id);
      const nextProfiles = [...profiles];

      if (existingIndex >= 0) {
        nextProfiles[existingIndex] = profile;
      } else {
        nextProfiles.push(profile);
      }

      await this.mappingSettings.saveProfiles(nextProfiles);
      await this.mappingSettings.setLastActiveProfileId(profile.id);
      this.activeMappingProfile = profile;
      return;
    }

    if (typeof mutation.selectProfileId === "undefined") {
      return;
    }

    if (mutation.selectProfileId === null) {
      await this.mappingSettings.setLastActiveProfileId(null);
      this.activeMappingProfile = null;
      return;
    }

    const profiles = await this.mappingSettings.loadProfiles();
    const profile = profiles.find((entry) => entry.id === mutation.selectProfileId) ?? null;

    if (!profile) {
      throw new Error("MAP_PROFILE_NOT_FOUND");
    }

    validateRequiredMappings(profile);
    await this.mappingSettings.setLastActiveProfileId(profile.id);
    this.activeMappingProfile = profile;
  }

  private async tryAutoApplyMappingFromSnapshot(
    snapshot: IngestionSnapshot,
    selectedQueryId: string,
    callerProvidedMutation: boolean
  ): Promise<void> {
    if (callerProvidedMutation) {
      return;
    }
    if (!this.mappingSettings) {
      return;
    }
    if (this.activeMappingProfile) {
      return;
    }
    if (snapshot.workItems.length === 0) {
      return;
    }

    const proposal = proposeDefaultMapping({
      queryId: selectedQueryId,
      availableFieldRefs: extractAvailableFieldRefs(snapshot)
    });

    if (proposal.status !== "valid") {
      return;
    }

    const profiles = await this.mappingSettings.loadProfiles();
    const existing = profiles.find((entry) => entry.id === proposal.profile.id);

    if (existing) {
      validateRequiredMappings(existing);
      await this.mappingSettings.setLastActiveProfileId(existing.id);
      this.activeMappingProfile = existing;
      return;
    }

    // normalize once for downstream persistence; validateRequiredMappings re-normalizes internally for its own checks
    const profile = normalizeProfile(proposal.profile);
    validateRequiredMappings(profile);
    await this.mappingSettings.saveProfiles([...profiles, profile]);
    await this.mappingSettings.setLastActiveProfileId(profile.id);
    this.activeMappingProfile = profile;
  }

  private async buildTimeline(snapshot: IngestionSnapshot): Promise<TimelineReadModel | null> {
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
  const requiredFields: readonly RequiredMappingField[] = REQUIRED_MAPPING_FIELDS;

  const issues: MappingValidationIssue[] = requiredFields.map((field) => ({
    code: "MAP_REQUIRED_MISSING",
    field,
    message: `${REQUIRED_FIELD_LABELS[field]} mapping is required.`,
    guidance: `Assign an Azure field reference for ${REQUIRED_FIELD_LABELS[field]}.`
  }));

  return {
    queryType: "flat",
    bars: [],
    unschedulable: [],
    dependencies: [],
    suppressedDependencies: [],
    mappingValidation: {
      status: "invalid",
      issues
    },
    treeLayout: null
  };
}

function toErrorCode(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "UNKNOWN";
}
