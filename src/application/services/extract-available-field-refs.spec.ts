import { describe, expect, it } from "vitest";

import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import { extractAvailableFieldRefs } from "./extract-available-field-refs.js";

function snapshot(workItems: IngestionSnapshot["workItems"]): IngestionSnapshot {
  return {
    queryType: "flat",
    workItemIds: workItems.map((item) => item.id),
    workItems,
    relations: [],
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

describe("extractAvailableFieldRefs", () => {
  it("includes System.Id and System.Title when items expose id and title", () => {
    const refs = extractAvailableFieldRefs(snapshot([{ id: 1, title: "A" }]));

    expect(refs).toContain("System.Id");
    expect(refs).toContain("System.Title");
  });

  it("collects extra field references from work-item keys", () => {
    const refs = extractAvailableFieldRefs(
      snapshot([
        {
          id: 1,
          title: "A",
          "Microsoft.VSTS.Scheduling.StartDate": "2026-01-01",
          "Microsoft.VSTS.Scheduling.TargetDate": "2026-01-02"
        }
      ])
    );

    expect(refs).toContain("Microsoft.VSTS.Scheduling.StartDate");
    expect(refs).toContain("Microsoft.VSTS.Scheduling.TargetDate");
  });

  it("deduplicates field references across multiple work items", () => {
    const refs = extractAvailableFieldRefs(
      snapshot([
        { id: 1, title: "A", "Custom.StartDate": "2026-01-01" },
        { id: 2, title: "B", "Custom.StartDate": "2026-01-02" }
      ])
    );

    expect(refs.filter((ref) => ref === "Custom.StartDate")).toHaveLength(1);
  });

  it("returns empty array when snapshot has no work items", () => {
    expect(extractAvailableFieldRefs(snapshot([]))).toEqual([]);
  });
});
