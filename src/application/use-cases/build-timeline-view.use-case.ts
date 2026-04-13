import type { TimelineReadModel } from "../dto/timeline-read-model.js";
import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { FieldMappingProfile } from "../../domain/mapping/field-mapping.js";
import { MappingValidationFailedError } from "../../domain/mapping/mapping-errors.js";
import { validateRequiredMappings } from "../../domain/mapping/mapping-validator.js";
import { buildCanonicalModel } from "../../domain/planning-model/canonical-model-builder.js";
import { projectTimeline } from "../../domain/planning-model/timeline-projection.js";
import { buildTreeLayout } from "../../domain/planning-model/tree-structure.js";

export type BuildTimelineViewInput = {
  snapshot: IngestionSnapshot;
  mappingProfile: FieldMappingProfile;
};

export class BuildTimelineViewUseCase {
  public execute(input: BuildTimelineViewInput): TimelineReadModel {
    try {
      const requiredMappings = validateRequiredMappings(input.mappingProfile);
      const canonical = buildCanonicalModel(input.snapshot, requiredMappings);

      const treeLayout = input.snapshot.queryType !== "flat"
        ? buildTreeLayout(canonical, input.snapshot.queryRelations)
        : null;

      const projection = projectTimeline(canonical, treeLayout);

      return {
        queryType: input.snapshot.queryType,
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
    } catch (error: unknown) {
      if (error instanceof MappingValidationFailedError) {
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

      throw error;
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
