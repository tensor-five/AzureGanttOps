import { describe, expect, it } from "vitest";

import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { FieldMappingProfile } from "../../domain/mapping/field-mapping.js";
import { BuildTimelineViewUseCase } from "./build-timeline-view.use-case.js";

describe("BuildTimelineViewUseCase", () => {
  it("returns projected timeline with state metadata and dependency suppression", async () => {
    const useCase = new BuildTimelineViewUseCase();
    const profile: FieldMappingProfile = {
      id: "profile-a",
      name: "Default",
      fields: {
        id: "Custom.ExternalId",
        title: "System.Title",
        start: "Custom.StartDate",
        endOrTarget: "Custom.TargetDate"
      }
    };

    const snapshot = createSnapshot([
      {
        id: 10,
        title: "fallback-a",
        "Custom.ExternalId": "WI-10",
        "System.Title": "Alpha",
        "Custom.StartDate": "2026-03-01",
        "Custom.TargetDate": "2026-03-03",
        "System.State": "Active"
      },
      {
        id: 20,
        title: "fallback-b",
        "Custom.ExternalId": "WI-20",
        "System.Title": "Beta",
        "Custom.StartDate": "",
        "Custom.TargetDate": "2026-03-05",
        "System.State": "New"
      },
      {
        id: 30,
        title: "fallback-c",
        "Custom.ExternalId": "WI-30",
        "System.Title": "Gamma",
        "Custom.StartDate": "",
        "Custom.TargetDate": "",
        "System.State": "Closed"
      }
    ], [
      {
        type: "System.LinkTypes.Dependency-Forward",
        sourceId: 10,
        targetId: 20
      },
      {
        type: "System.LinkTypes.Dependency-Forward",
        sourceId: 20,
        targetId: 30
      }
    ]);

    const result = await useCase.execute({ snapshot, mappingProfile: profile });

    expect(result.mappingValidation).toEqual({ status: "valid", issues: [] });
    expect(result.bars).toHaveLength(2);
    expect(result.bars[0].title).toBe("Beta");
    expect(result.bars[0].state).toEqual({
      code: "New",
      badge: "N",
      color: "#7c3aed"
    });
    expect(result.bars[0].schedule.missingBoundary).toBe("start");
    expect(result.bars[1].title).toBe("Alpha");
    expect(result.unschedulable).toHaveLength(1);
    expect(result.unschedulable[0]).toMatchObject({
      title: "Gamma",
      state: {
        code: "Closed",
        badge: "C",
        color: "#6b7280"
      }
    });
    expect(result.dependencies).toHaveLength(1);
    expect(result.suppressedDependencies).toEqual([
      {
        predecessorWorkItemId: 20,
        successorWorkItemId: 30,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      }
    ]);
  });

  it("short-circuits with deterministic mapping guidance when required mappings are invalid", async () => {
    const useCase = new BuildTimelineViewUseCase();
    const invalidProfile: FieldMappingProfile = {
      id: "profile-b",
      name: "Invalid",
      fields: {
        id: "",
        title: "System.Title",
        start: "Custom.StartDate",
        endOrTarget: "Custom.StartDate"
      }
    };

    const result = await useCase.execute({
      snapshot: createSnapshot([], []),
      mappingProfile: invalidProfile
    });

    expect(result.mappingValidation.status).toBe("invalid");
    expect(result.mappingValidation.issues.map((issue) => issue.code)).toEqual([
      "MAP_REQUIRED_BLANK",
      "MAP_REQUIRED_DUPLICATE",
      "MAP_REQUIRED_DUPLICATE"
    ]);
    expect(result.bars).toEqual([]);
    expect(result.unschedulable).toEqual([]);
    expect(result.dependencies).toEqual([]);
    expect(result.suppressedDependencies).toEqual([]);
  });
});

function createSnapshot(
  workItems: Array<Record<string, unknown> & { id: number; title: string }>,
  relations: IngestionSnapshot["relations"]
): IngestionSnapshot {
  return {
    queryType: "flat",
    workItemIds: workItems.map((item) => item.id),
    workItems: workItems as unknown as IngestionSnapshot["workItems"],
    relations,
    queryRelations: [],
    hydration: {
      maxIdsPerBatch: 200,
      requestedIds: workItems.length,
      attemptedBatches: 1,
      succeededBatches: 1,
      retriedRequests: 0,
      missingIds: [],
      partial: false,
      statusCode: "OK"
    }
  };
}
