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
  it("MAP-03 + GNT-01: full reload on switch keeps latest active source and mapped timeline", async () => {
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
          timeline: {
            bars: [
              {
                workItemId: 11,
                title: "A-11",
                state: { code: "Active", badge: "A", color: "#1d4ed8" },
                schedule: {
                  startDate: "2026-03-04T20:00:00.000Z",
                  endDate: "2026-03-05T20:00:00.000Z",
                  missingBoundary: null
                },
                details: { mappedId: "WI-11" }
              }
            ],
            unschedulable: [],
            dependencies: [],
            suppressedDependencies: [],
            mappingValidation: {
              status: "valid" as const,
              issues: []
            }
          },
          activeMappingProfileId: "profile-a",
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
          timeline: {
            bars: [
              {
                workItemId: 22,
                title: "B-22",
                state: { code: "New", badge: "N", color: "#7c3aed" },
                schedule: {
                  startDate: "2026-03-04T20:00:01.000Z",
                  endDate: null,
                  missingBoundary: "end" as const
                },
                details: { mappedId: "WI-22" }
              }
            ],
            unschedulable: [],
            dependencies: [],
            suppressedDependencies: [],
            mappingValidation: {
              status: "valid" as const,
              issues: []
            }
          },
          activeMappingProfileId: "profile-a",
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

    expect(first.success).toBe(true);
    expect(first.workItemIds).toEqual([11]);
    expect(first.activeQueryId).toBe("a");
    expect(first.activeMappingProfileId).toBe("profile-a");

    expect(second.success).toBe(true);
    expect(second.workItemIds).toEqual([22]);
    expect(second.activeQueryId).toBe("b");
    expect(second.lastRefreshAt).toBe("2026-03-04T20:00:01.000Z");
    expect(second.reloadSource).toBe("full_reload");
  });

  it("MAP-02: strict mapping validation blocks timeline and emits guidance", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: "x",
        snapshot: {
          queryType: "flat" as const,
          workItemIds: [1001],
          workItems: [{ id: 1001, title: "Item" }],
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
        timeline: {
          bars: [],
          unschedulable: [],
          dependencies: [],
          suppressedDependencies: [],
          mappingValidation: {
            status: "invalid" as const,
            issues: [
              {
                code: "MAP_REQUIRED_BLANK" as const,
                field: "start" as const,
                message: "Start Date mapping cannot be blank.",
                guidance: "Provide a non-empty Azure field reference for Start Date."
              }
            ]
          }
        } as const,
        activeMappingProfileId: "profile-a",
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "x",
          lastRefreshAt: "2026-03-04T20:00:02.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const result = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    });

    expect(result.success).toBe(false);
    expect(result.mappingValidation.status).toBe("invalid");
    expect(result.timeline?.bars).toEqual([]);
    expect(result.timeline?.dependencies).toEqual([]);
    expect(result.guidance).toContain("Fix required mapping fields before rendering timeline");
  });

  it("GNT-03 + GNT-05: half-open bars and unschedulable dependency suppression are preserved", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: "x",
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
        timeline: {
          bars: [
            {
              workItemId: 1002,
              title: "Child",
              state: { code: "New", badge: "N", color: "#7c3aed" },
              schedule: {
                startDate: null,
                endDate: "2026-03-10T00:00:00.000Z",
                missingBoundary: "start" as const
              },
              details: { mappedId: "WI-1002" }
            }
          ],
          unschedulable: [
            {
              workItemId: 1003,
              title: "Blocked",
              state: { code: "Closed", badge: "C", color: "#6b7280" },
              details: { mappedId: "WI-1003" },
              reason: "missing-both-dates" as const
            }
          ],
          dependencies: [],
          suppressedDependencies: [
            {
              predecessorWorkItemId: 1002,
              successorWorkItemId: 1003,
              dependencyType: "FS" as const,
              reason: "unschedulable-endpoint" as const
            }
          ],
          mappingValidation: {
            status: "valid" as const,
            issues: []
          }
        } as const,
        activeMappingProfileId: "profile-a",
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "x",
          lastRefreshAt: "2026-03-04T20:00:04.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const result = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    });

    expect(result.success).toBe(true);
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
    expect(result.timeline?.bars[0].schedule.missingBoundary).toBe("start");
    expect(result.timeline?.suppressedDependencies).toEqual([
      {
        predecessorWorkItemId: 1002,
        successorWorkItemId: 1003,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      }
    ]);
    expect(result.view).toContain("Suppressed dependencies (details only):");
  });

  it("GNT-05: default FS arrows visible and toggle can hide them", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: "x",
        snapshot: {
          queryType: "flat" as const,
          workItemIds: [1, 2],
          workItems: [
            { id: 1, title: "A" },
            { id: 2, title: "B" }
          ],
          relations: [],
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
        timeline: {
          bars: [],
          unschedulable: [],
          dependencies: [
            {
              predecessorWorkItemId: 1,
              successorWorkItemId: 2,
              dependencyType: "FS" as const,
              label: "#1 [end] -> #2 [start]"
            }
          ],
          suppressedDependencies: [],
          mappingValidation: {
            status: "valid" as const,
            issues: []
          }
        },
        activeMappingProfileId: "profile-a",
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "x",
          lastRefreshAt: "2026-03-04T20:00:05.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const result = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    });

    expect(result.view).toContain("Dependency arrows: shown");
    expect(result.view).toContain("#1 [end] -> #2 [start]");

    expect(result.view).not.toContain("popover");
  });

  it("REL + MAP: runtime transient and mapping-valid partial states keep deterministic trust guidance", async () => {
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
          timeline: {
            bars: [
              {
                workItemId: 1001,
                title: "Ready item",
                state: { code: "Active", badge: "A", color: "#1d4ed8" },
                schedule: {
                  startDate: "2026-03-11T00:00:00.000Z",
                  endDate: "2026-03-12T00:00:00.000Z",
                  missingBoundary: null
                },
                details: { mappedId: "WI-1001" }
              }
            ],
            unschedulable: [],
            dependencies: [],
            suppressedDependencies: [],
            mappingValidation: {
              status: "valid" as const,
              issues: []
            }
          },
          activeMappingProfileId: "profile-a",
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
});
