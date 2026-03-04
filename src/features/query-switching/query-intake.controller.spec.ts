import { describe, expect, it, vi } from "vitest";

import type { AdoContext } from "../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../app/config/ado-context.store.js";
import { QueryId } from "../../domain/query-runtime/value-objects/query-id.js";
import { QueryIntakeController } from "./query-intake.controller.js";

class InMemoryContextSettings {
  public context: AdoContext | null;

  public constructor(context: AdoContext | null) {
    this.context = context;
  }

  public getContext(): Promise<AdoContext | null> {
    return Promise.resolve(this.context);
  }

  public saveContext(context: AdoContext): Promise<void> {
    this.context = context;
    return Promise.resolve();
  }
}

describe("QueryIntakeController", () => {
  it("returns success payload with source/freshness metadata and FS arrows", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const queryId = QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95");
    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [
          {
            id: queryId.value,
            name: "Delivery Timeline",
            path: "Shared Queries/Delivery Timeline"
          }
        ],
        selectedQueryId: queryId.value,
        snapshot: {
          queryType: "flat" as const,
          workItemIds: [101, 202],
          workItems: [
            { id: 101, title: "A" },
            { id: 202, title: "B" }
          ],
          relations: [
            {
              type: "System.LinkTypes.Dependency-Forward" as const,
              sourceId: 101,
              targetId: 202
            }
          ],
          hydration: {
            maxIdsPerBatch: 200,
            requestedIds: 2,
            attemptedBatches: 1,
            succeededBatches: 1,
            retriedRequests: 0,
            missingIds: [],
            partial: false,
            statusCode: "OK" as const
          }
        },
        reload: {
          runVersion: 2,
          stale: false,
          activeQueryId: queryId.value,
          lastRefreshAt: "2026-03-04T20:00:00.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.success).toBe(true);
    expect(response.preflightStatus).toBe("READY");
    expect(response.activeQueryId).toBe(queryId.value);
    expect(response.lastRefreshAt).toBe("2026-03-04T20:00:00.000Z");
    expect(response.reloadSource).toBe("full_reload");
    expect(response.trustState).toBe("ready");
    expect(response.workItemIds).toEqual([101, 202]);
    expect(response.fsArrows).toEqual([
      {
        predecessorId: 101,
        successorId: 202,
        label: "#101 [end] -> #202 [start]"
      }
    ]);
    expect(response.view).toContain("Phase 2 note: only flat queries are supported.");
  });

  it("returns deterministic guidance for unsupported query shape", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async () => {
        throw new Error("QRY_SHAPE_UNSUPPORTED");
      })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.success).toBe(false);
    expect(response.trustState).toBe("needs_attention");
    expect(response.guidance).toBe("Only flat queries are supported in this phase. Use a flat query and retry.");
  });

  it("returns deterministic guidance for transient retry exhaustion", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async () => {
        throw new Error("HYDRATION_TRANSIENT_RETRY_EXHAUSTED");
      })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.success).toBe(false);
    expect(response.guidance).toBe("Hydration retries were exhausted. Retry shortly.");
    expect(response.workItemIds).toEqual([]);
  });

  it("maps partial hydration result to trust-first partial state", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const queryId = QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95");
    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: queryId.value,
        snapshot: {
          queryType: "flat" as const,
          workItemIds: [101, 202],
          workItems: [{ id: 101, title: "A" }],
          relations: [],
          hydration: {
            maxIdsPerBatch: 200,
            requestedIds: 2,
            attemptedBatches: 1,
            succeededBatches: 1,
            retriedRequests: 1,
            missingIds: [202],
            partial: true,
            statusCode: "HYDRATION_PARTIAL_FAILURE" as const
          }
        },
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: queryId.value,
          lastRefreshAt: "2026-03-04T20:00:00.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: `https://dev.azure.com/contoso/delivery/_queries/query?qid=${queryId.value}`
    });

    expect(response.success).toBe(true);
    expect(response.trustState).toBe("partial_failure");
    expect(response.guidance).toBe("Some work items could not be hydrated. Retry to improve completeness.");
  });
});
