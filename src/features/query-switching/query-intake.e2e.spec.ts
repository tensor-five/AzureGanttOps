import { describe, expect, it, vi } from "vitest";

import type { AdoContext } from "../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../app/config/ado-context.store.js";
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

describe("query-intake boundary e2e", () => {
  it("full reload on switch updates active source metadata to latest query", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [{ id: "a", name: "A", path: "Shared Queries/A" }],
          selectedQueryId: "a",
          snapshot: {
            queryType: "flat" as const,
            workItemIds: [11],
            workItems: [{ id: 11, title: "A-11" }],
            relations: [],
            hydration: {
              maxIdsPerBatch: 200,
              requestedIds: 1,
              attemptedBatches: 1,
              succeededBatches: 1,
              retriedRequests: 0,
              missingIds: [],
              partial: false,
              statusCode: "OK" as const
            }
          },
          reload: {
            runVersion: 1,
            stale: false,
            activeQueryId: "a",
            lastRefreshAt: "2026-03-04T20:00:00.000Z",
            source: "full_reload" as const
          }
        })
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [{ id: "b", name: "B", path: "Shared Queries/B" }],
          selectedQueryId: "b",
          snapshot: {
            queryType: "flat" as const,
            workItemIds: [22],
            workItems: [{ id: 22, title: "B-22" }],
            relations: [],
            hydration: {
              maxIdsPerBatch: 200,
              requestedIds: 1,
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
            activeQueryId: "b",
            lastRefreshAt: "2026-03-04T20:00:01.000Z",
            source: "full_reload" as const
          }
        })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const first = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
    });
    const second = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"
    });

    expect(first.workItemIds).toEqual([11]);
    expect(first.activeQueryId).toBe("a");
    expect(second.workItemIds).toEqual([22]);
    expect(second.activeQueryId).toBe("b");
    expect(second.lastRefreshAt).toBe("2026-03-04T20:00:01.000Z");
    expect(second.reloadSource).toBe("full_reload");
  });

  it("discards stale run result and never overwrites latest selection", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [],
          selectedQueryId: "a",
          snapshot: null,
          reload: {
            runVersion: 1,
            stale: true,
            activeQueryId: "b",
            lastRefreshAt: null,
            source: "stale_discarded" as const
          }
        })
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [],
          selectedQueryId: "b",
          snapshot: {
            queryType: "flat" as const,
            workItemIds: [22],
            workItems: [{ id: 22, title: "B-22" }],
            relations: [],
            hydration: {
              maxIdsPerBatch: 200,
              requestedIds: 1,
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
            activeQueryId: "b",
            lastRefreshAt: "2026-03-04T20:00:02.000Z",
            source: "full_reload" as const
          }
        })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const stale = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
    });
    const latest = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"
    });

    expect(stale.success).toBe(false);
    expect(stale.reloadSource).toBe("stale_discarded");
    expect(stale.workItemIds).toEqual([]);
    expect(stale.activeQueryId).toBe("b");

    expect(latest.success).toBe(true);
    expect(latest.activeQueryId).toBe("b");
    expect(latest.workItemIds).toEqual([22]);
  });

  it("surfaces unsupported shape guidance without fabricated hydration data", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async () => {
        throw new Error("QRY_SHAPE_UNSUPPORTED");
      })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const result = await controller.submit({ queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95" });

    expect(result.success).toBe(false);
    expect(result.guidance).toBe("Only flat queries are supported in this phase. Use a flat query and retry.");
    expect(result.workItemIds).toEqual([]);
    expect(result.relations).toEqual([]);
  });

  it("maps transient retry exhaustion and partial hydration trust states", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const transientFailureController = new QueryIntakeController(
      store,
      {
        execute: vi.fn(async () => {
          throw new Error("HYDRATION_TRANSIENT_RETRY_EXHAUSTED");
        })
      } as never
    );

    const transient = await transientFailureController.submit({ queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95" });

    expect(transient.success).toBe(false);
    expect(transient.trustState).toBe("needs_attention");
    expect(transient.guidance).toBe("Hydration retries were exhausted. Retry shortly.");

    const partialController = new QueryIntakeController(
      store,
      {
        execute: vi.fn(async () => ({
          preflight: { status: "READY" as const },
          savedQueries: [],
          selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          snapshot: {
            queryType: "flat" as const,
            workItemIds: [1001, 1002],
            workItems: [{ id: 1001, title: "Ready item" }],
            relations: [],
            hydration: {
              maxIdsPerBatch: 200,
              requestedIds: 2,
              attemptedBatches: 1,
              succeededBatches: 1,
              retriedRequests: 1,
              missingIds: [1002],
              partial: true,
              statusCode: "HYDRATION_PARTIAL_FAILURE" as const
            }
          },
          reload: {
            runVersion: 3,
            stale: false,
            activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
            lastRefreshAt: "2026-03-04T20:00:03.000Z",
            source: "full_reload" as const
          }
        }))
      } as never
    );

    const partial = await partialController.submit({ queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95" });

    expect(partial.success).toBe(true);
    expect(partial.trustState).toBe("partial_failure");
    expect(partial.guidance).toBe("Some work items could not be hydrated. Retry to improve completeness.");
  });

  it("preserves dependency and hierarchy relation semantics in response and view", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        snapshot: {
          queryType: "flat" as const,
          workItemIds: [1001, 1002, 1003],
          workItems: [
            { id: 1001, title: "Parent" },
            { id: 1002, title: "Child" },
            { id: 1003, title: "Blocked" }
          ],
          relations: [
            {
              type: "System.LinkTypes.Hierarchy-Forward" as const,
              sourceId: 1001,
              targetId: 1002
            },
            {
              type: "System.LinkTypes.Dependency-Reverse" as const,
              sourceId: 1003,
              targetId: 1002
            }
          ],
          hydration: {
            maxIdsPerBatch: 200,
            requestedIds: 3,
            attemptedBatches: 1,
            succeededBatches: 1,
            retriedRequests: 0,
            missingIds: [],
            partial: false,
            statusCode: "OK" as const
          }
        },
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          lastRefreshAt: "2026-03-04T20:00:04.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const result = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(result.relations).toEqual([
      {
        type: "System.LinkTypes.Hierarchy-Forward",
        sourceId: 1001,
        targetId: 1002
      },
      {
        type: "System.LinkTypes.Dependency-Reverse",
        sourceId: 1003,
        targetId: 1002
      }
    ]);
    expect(result.fsArrows).toEqual([
      {
        predecessorId: 1002,
        successorId: 1003,
        label: "#1002 [end] -> #1003 [start]"
      }
    ]);
    expect(result.view).toContain("Phase 2 note: only flat queries are supported.");
    expect(result.view).toContain("#1002 [end] -> #1003 [start]");
  });
});
