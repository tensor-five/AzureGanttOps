import type { TimelineReadModel } from "../dto/timeline-read-model.js";
import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { FieldMappingProfile } from "../../domain/mapping/field-mapping.js";
import { MappingValidationFailedError } from "../../domain/mapping/mapping-errors.js";
import { validateRequiredMappings } from "../../domain/mapping/mapping-validator.js";
import { buildCanonicalModel } from "../../domain/planning-model/canonical-model-builder.js";
import { projectTimeline } from "../../domain/planning-model/timeline-projection.js";

export type BuildTimelineViewInput = {
  snapshot: IngestionSnapshot;
  mappingProfile: FieldMappingProfile;
};

export class BuildTimelineViewUseCase {
  public execute(input: BuildTimelineViewInput): TimelineReadModel {
    try {
      const requiredMappings = validateRequiredMappings(input.mappingProfile);
      const canonical = buildCanonicalModel(input.snapshot, requiredMappings);
      const projection = projectTimeline(canonical);

      return {
        bars: projection.bars,
        unschedulable: projection.unschedulable,
        dependencies: projection.dependencies,
        suppressedDependencies: projection.suppressedDependencies,
        mappingValidation: {
          status: "valid",
          issues: []
        }
      };
    } catch (error: unknown) {
      if (error instanceof MappingValidationFailedError) {
        return {
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
          }
        };
      }

      throw error;
    }
  }
}
