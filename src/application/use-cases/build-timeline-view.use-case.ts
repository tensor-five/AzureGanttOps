import type { TimelineReadModel } from "../dto/timeline-read-model.js";
import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { FieldMappingProfile } from "../../domain/mapping/field-mapping.js";
import type { IterationsPort } from "../ports/iterations.port.js";
import { MappingValidationFailedError } from "../../domain/mapping/mapping-errors.js";
import { validateRequiredMappings } from "../../domain/mapping/mapping-validator.js";
import { buildCanonicalModel } from "../../domain/planning-model/canonical-model-builder.js";
import { projectTimeline } from "../../domain/planning-model/timeline-projection.js";
import { buildTreeLayout } from "../../domain/planning-model/tree-structure.js";
import { buildIterationDatesMap } from "../../shared/utils/iteration-scheduling.js";
import { elapsedSince, writePerformanceLog } from "../../shared/telemetry/performance-log.js";

export type BuildTimelineViewInput = {
  snapshot: IngestionSnapshot;
  mappingProfile: FieldMappingProfile;
};

type IterationDatesMap = Record<string, { startDate: string; endDate: string }>;

export type BuildTimelineViewOptions = {
  iterationCacheTtlMs?: number;
};

const DEFAULT_ITERATION_CACHE_TTL_MS = 60_000;

export class BuildTimelineViewUseCase {
  private iterationCache: { value: IterationDatesMap; fetchedAt: number } | null = null;
  private readonly iterationCacheTtlMs: number;

  public constructor(
    private readonly iterationsPort?: IterationsPort | null,
    options?: BuildTimelineViewOptions
  ) {
    this.iterationCacheTtlMs = options?.iterationCacheTtlMs ?? DEFAULT_ITERATION_CACHE_TTL_MS;
  }

  public async execute(input: BuildTimelineViewInput): Promise<TimelineReadModel> {
    const startedAt = Date.now();
    writePerformanceLog("timeline-build", "start", {
      queryType: input.snapshot.queryType,
      workItems: input.snapshot.workItems.length
    });

    try {
      const validationStartedAt = Date.now();
      const requiredMappings = validateRequiredMappings(input.mappingProfile);
      writePerformanceLog("timeline-build", "mapping.done", {
        durationMs: elapsedSince(validationStartedAt)
      });

      const canonicalStartedAt = Date.now();
      const canonical = buildCanonicalModel(input.snapshot, requiredMappings);
      writePerformanceLog("timeline-build", "canonical.done", {
        tasks: canonical.tasks.length,
        dependencies: canonical.dependencies.length,
        durationMs: elapsedSince(canonicalStartedAt)
      });

      const treeStartedAt = Date.now();
      const treeLayout = input.snapshot.queryType !== "flat"
        ? buildTreeLayout(canonical, input.snapshot.queryRelations)
        : null;
      writePerformanceLog("timeline-build", "tree.done", {
        enabled: treeLayout !== null,
        nodes: treeLayout?.metaByWorkItemId.size ?? 0,
        durationMs: elapsedSince(treeStartedAt)
      });

      const iterationDates = await this.resolveIterationDates();
      const projectionStartedAt = Date.now();
      const projection = projectTimeline(canonical, treeLayout, iterationDates);
      writePerformanceLog("timeline-build", "projection.done", {
        bars: projection.bars.length,
        unschedulable: projection.unschedulable.length,
        dependencies: projection.dependencies.length,
        suppressedDependencies: projection.suppressedDependencies.length,
        durationMs: elapsedSince(projectionStartedAt)
      });

      const result: TimelineReadModel = {
        queryType: input.snapshot.queryType,
        scheduleFieldRefs: {
          start: requiredMappings.start,
          endOrTarget: requiredMappings.endOrTarget
        },
        bars: projection.bars,
        unschedulable: projection.unschedulable,
        dependencies: projection.dependencies,
        suppressedDependencies: projection.suppressedDependencies,
        mappingValidation: {
          status: "valid",
          issues: []
        },
        treeLayout: treeLayout ? mapToRecord(treeLayout.metaByWorkItemId) : null
      };
      writePerformanceLog("timeline-build", "done", {
        durationMs: elapsedSince(startedAt)
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof MappingValidationFailedError) {
        writePerformanceLog("timeline-build", "mapping.invalid", {
          issues: error.errors.length,
          durationMs: elapsedSince(startedAt)
        });

        return {
          queryType: input.snapshot.queryType,
          bars: [],
          unschedulable: [],
          dependencies: [],
          suppressedDependencies: [],
          mappingValidation: {
            status: "invalid",
            issues: [...error.errors].sort((left, right) => {
              const byCode = left.code.localeCompare(right.code);
              if (byCode !== 0) {
                return byCode;
              }

              return left.field.localeCompare(right.field);
            })
          },
          treeLayout: null
        };
      }

      writePerformanceLog("timeline-build", "failed", {
        durationMs: elapsedSince(startedAt)
      });
      throw error;
    }
  }

  public invalidateIterationCache(): void {
    this.iterationCache = null;
  }

  private async resolveIterationDates(): Promise<IterationDatesMap | null> {
    if (!this.iterationsPort) {
      return null;
    }

    const now = Date.now();
    if (this.iterationCache && now - this.iterationCache.fetchedAt < this.iterationCacheTtlMs) {
      writePerformanceLog("timeline-build", "iterations.cache-hit", {
        entries: Object.keys(this.iterationCache.value).length
      });
      return this.iterationCache.value;
    }

    try {
      const startedAt = Date.now();
      writePerformanceLog("timeline-build", "iterations.fetch.start");
      const iterations = await this.iterationsPort.listIterations();
      const map = buildIterationDatesMap(
        iterations.map((iter) => ({
          path: iter.path,
          startDate: iter.startDate,
          endDate: iter.endDate
        }))
      );
      this.iterationCache = { value: map, fetchedAt: now };
      writePerformanceLog("timeline-build", "iterations.fetch.done", {
        iterations: iterations.length,
        entries: Object.keys(map).length,
        durationMs: elapsedSince(startedAt)
      });
      return map;
    } catch {
      writePerformanceLog("timeline-build", "iterations.fetch.failed", {
        fallbackCache: this.iterationCache !== null
      });
      return this.iterationCache?.value ?? null;
    }
  }
}

function mapToRecord<V>(map: ReadonlyMap<number, V>): Record<string, V> {
  const record: Record<string, V> = {};
  for (const [key, value] of map) {
    record[String(key)] = value;
  }
  return record;
}
