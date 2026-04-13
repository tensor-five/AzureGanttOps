import { describe, expect, it } from "vitest";

import type { IngestionSnapshot } from "../../application/dto/ingestion-snapshot.js";
import type { RequiredFieldMappings } from "../mapping/field-mapping.js";
import { buildCanonicalModel } from "./canonical-model-builder.js";

describe("buildCanonicalModel", () => {
  it("builds canonical tasks and dependencies from mapped ingestion data", () => {
    const mappings: RequiredFieldMappings = {
      id: "Custom.ExternalId",
      title: "System.Title",
      start: "Custom.StartDate",
      endOrTarget: "Custom.TargetDate"
    };

    const snapshot: IngestionSnapshot = {
      queryType: "flat",
      workItemIds: [101, 202],
      workItems: [
        {
          id: 101,
          title: "fallback-a",
          System: "ignored",
          "System.Title": "Plan sprint",
          "Custom.ExternalId": "WI-101",
          "Custom.StartDate": "2026-03-01",
          "Custom.TargetDate": "2026-03-03",
          "System.State": "Active"
        } as unknown as IngestionSnapshot["workItems"][number],
        {
          id: 202,
          title: "fallback-b",
          "System.Title": "Release",
          "Custom.ExternalId": 202,
          "Custom.StartDate": "",
          "Custom.TargetDate": "2026-03-10",
          "System.State": "Closed"
        } as unknown as IngestionSnapshot["workItems"][number]
      ],
      relations: [
        {
          type: "System.LinkTypes.Dependency-Forward",
          sourceId: 101,
          targetId: 202
        },
        {
          type: "System.LinkTypes.Dependency-Reverse",
          sourceId: 404,
          targetId: 202
        },
        {
          type: "System.LinkTypes.Hierarchy-Forward",
          sourceId: 101,
          targetId: 202
        }
      ],
      queryRelations: [],
      hydration: {
        maxIdsPerBatch: 200,
        requestedIds: 2,
        attemptedBatches: 1,
        succeededBatches: 1,
        retriedRequests: 0,
        missingIds: [],
        partial: false,
        statusCode: "OK"
      }
    };

    const result = buildCanonicalModel(snapshot, mappings);

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toMatchObject({
      workItemId: 101,
      mappedId: "WI-101",
      title: "Plan sprint",
      state: {
        code: "Active",
        badge: "A",
        color: "#1d4ed8"
      }
    });
    expect(result.tasks[0].startDate).toBe("2026-03-01T00:00:00.000Z");
    expect(result.tasks[0].endDate).toBe("2026-03-03T00:00:00.000Z");

    expect(result.tasks[1]).toMatchObject({
      workItemId: 202,
      mappedId: "202",
      title: "Release",
      endDate: "2026-03-10T00:00:00.000Z",
      state: {
        code: "Closed",
        badge: "C",
        color: "#6b7280"
      }
    });
    expect(result.tasks[1].startDate).toBeNull();

    expect(result.dependencies).toEqual([
      {
        predecessorWorkItemId: 101,
        successorWorkItemId: 202,
        relationType: "System.LinkTypes.Dependency-Forward",
        dependencyType: "FS"
      },
      {
        predecessorWorkItemId: 202,
        successorWorkItemId: 404,
        relationType: "System.LinkTypes.Dependency-Reverse",
        dependencyType: "FS"
      }
    ]);
  });

  it("is deterministic for repeated input", () => {
    const mappings: RequiredFieldMappings = {
      id: "Custom.Id",
      title: "System.Title",
      start: "Custom.Start",
      endOrTarget: "Custom.End"
    };

    const snapshot: IngestionSnapshot = {
      queryType: "flat",
      workItemIds: [1],
      workItems: [
        {
          id: 1,
          title: "fallback",
          "Custom.Id": "X-1",
          "System.Title": "Stable",
          "Custom.Start": "2026-01-01",
          "Custom.End": "2026-01-02"
        } as unknown as IngestionSnapshot["workItems"][number]
      ],
      relations: [],
      queryRelations: [],
      hydration: {
        maxIdsPerBatch: 200,
        requestedIds: 1,
        attemptedBatches: 1,
        succeededBatches: 1,
        retriedRequests: 0,
        missingIds: [],
        partial: false,
        statusCode: "OK"
      }
    };

    const first = buildCanonicalModel(snapshot, mappings);
    const second = buildCanonicalModel(snapshot, mappings);

    expect(second).toEqual(first);
  });
});
