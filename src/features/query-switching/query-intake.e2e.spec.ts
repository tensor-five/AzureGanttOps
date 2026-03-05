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
          },
          failureCode: null,
          lastSuccessfulReload: {
            activeQueryId: "a",
            lastRefreshAt: "2026-03-04T20:00:00.000Z",
            source: "full_reload" as const
          },
          lastKnownGood: {
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
            activeMappingProfileId: "profile-a"
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
          },
          failureCode: null,
          lastSuccessfulReload: {
            activeQueryId: "b",
            lastRefreshAt: "2026-03-04T20:00:01.000Z",
            source: "full_reload" as const
          },
          lastKnownGood: {
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
            activeMappingProfileId: "profile-a"
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
    expect(first.uiState).toBe("ready");

    expect(second.success).toBe(true);
    expect(second.workItemIds).toEqual([22]);
    expect(second.activeQueryId).toBe("b");
    expect(second.lastRefreshAt).toBe("2026-03-04T20:00:01.000Z");
    expect(second.reloadSource).toBe("full_reload");
    expect(second.uiState).toBe("ready");
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
        },
        failureCode: null,
        lastSuccessfulReload: null,
        lastKnownGood: null
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
    expect(result.uiState).toBe("empty");
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
        },
        failureCode: null,
        lastSuccessfulReload: null,
        lastKnownGood: null
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
    expect(result.uiState).toBe("ready");
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
        },
        failureCode: null,
        lastSuccessfulReload: null,
        lastKnownGood: null
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const result = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
    });

    expect(result.view).toContain("Dependency arrows: shown");
    expect(result.view).toContain("#1 [end] -> #2 [start]");

    const hidden = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      showDependencies: false
    });

    expect(hidden.view).toContain("Dependency arrows: hidden");
    expect(hidden.view).not.toContain("#1 [end] -> #2 [start]");

    expect(result.view).not.toContain("popover");
  });

  it("MAP-01 + MAP-03: mapping upsert/select flows through controller and is reapplied by restart", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const runQueryIntake = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [],
          selectedQueryId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          snapshot: null,
          timeline: null,
          activeMappingProfileId: "profile-b",
          reload: {
            runVersion: 1,
            stale: false,
            activeQueryId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            lastRefreshAt: null,
            source: "full_reload" as const
          },
          failureCode: null,
          lastSuccessfulReload: null,
          lastKnownGood: null
        })
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [],
          selectedQueryId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          snapshot: null,
          timeline: null,
          activeMappingProfileId: "profile-b",
          reload: {
            runVersion: 2,
            stale: false,
            activeQueryId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            lastRefreshAt: null,
            source: "full_reload" as const
          },
          failureCode: null,
          lastSuccessfulReload: null,
          lastKnownGood: null
        })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=ffffffff-ffff-4fff-8fff-ffffffffffff",
      mappingProfileUpsert: {
        id: "profile-b",
        name: "Secondary",
        fields: {
          id: "Custom.ExternalId2",
          title: "System.Title",
          start: "Custom.StartDate2",
          endOrTarget: "Custom.TargetDate2"
        }
      }
    });

    await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=ffffffff-ffff-4fff-8fff-ffffffffffff",
      mappingProfileId: "profile-b"
    });

    expect(runQueryIntake.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mappingMutation: {
          selectProfileId: undefined,
          upsertProfile: {
            id: "profile-b",
            name: "Secondary",
            fields: {
              id: "Custom.ExternalId2",
              title: "System.Title",
              start: "Custom.StartDate2",
              endOrTarget: "Custom.TargetDate2"
            }
          }
        }
      })
    );

    expect(runQueryIntake.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mappingMutation: {
          selectProfileId: "profile-b",
          upsertProfile: undefined
        }
      })
    );
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
    expect(transient.uiState).toBe("query_failure");
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
          },
          failureCode: null,
          lastSuccessfulReload: {
            activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
            lastRefreshAt: "2026-03-04T20:00:03.000Z",
            source: "full_reload" as const
          },
          lastKnownGood: null
        }))
      } as never
    );

    const partial = await partialController.submit({ queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95" });

    expect(partial.success).toBe(true);
    expect(partial.trustState).toBe("partial_failure");
    expect(partial.uiState).toBe("partial_failure");
    expect(partial.guidance).toBe("Some work items could not be hydrated. Retry to improve completeness.");
  });

  it("REL-04 + REL-01: refresh failure after success keeps LKG, warning, and deterministic state", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [],
          selectedQueryId: "x",
          snapshot: {
            queryType: "flat" as const,
            workItemIds: [1],
            workItems: [{ id: 1, title: "A" }],
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
                workItemId: 1,
                title: "A",
                state: { code: "Active", badge: "A", color: "#1d4ed8" },
                schedule: {
                  startDate: "2026-03-01T00:00:00.000Z",
                  endDate: "2026-03-02T00:00:00.000Z",
                  missingBoundary: null
                },
                details: { mappedId: "WI-1" }
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
            activeQueryId: "x",
            lastRefreshAt: "2026-03-04T20:00:00.000Z",
            source: "full_reload" as const
          },
          failureCode: null,
          lastSuccessfulReload: {
            activeQueryId: "x",
            lastRefreshAt: "2026-03-04T20:00:00.000Z",
            source: "full_reload" as const
          },
          lastKnownGood: {
            selectedQueryId: "x",
            snapshot: {
              queryType: "flat" as const,
              workItemIds: [1],
              workItems: [{ id: 1, title: "A" }],
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
                  workItemId: 1,
                  title: "A",
                  state: { code: "Active", badge: "A", color: "#1d4ed8" },
                  schedule: {
                    startDate: "2026-03-01T00:00:00.000Z",
                    endDate: "2026-03-02T00:00:00.000Z",
                    missingBoundary: null
                  },
                  details: { mappedId: "WI-1" }
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
            activeMappingProfileId: "profile-a"
          }
        })
        .mockResolvedValueOnce({
          preflight: { status: "READY" as const },
          savedQueries: [],
          selectedQueryId: "x",
          snapshot: null,
          timeline: null,
          activeMappingProfileId: "profile-a",
          reload: {
            runVersion: 2,
            stale: false,
            activeQueryId: "x",
            lastRefreshAt: null,
            source: "full_reload" as const
          },
          failureCode: "QUERY_EXECUTION_FAILED",
          lastSuccessfulReload: {
            activeQueryId: "x",
            lastRefreshAt: "2026-03-04T20:00:00.000Z",
            source: "full_reload" as const
          },
          lastKnownGood: {
            selectedQueryId: "x",
            snapshot: {
              queryType: "flat" as const,
              workItemIds: [1],
              workItems: [{ id: 1, title: "A" }],
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
                  workItemId: 1,
                  title: "A",
                  state: { code: "Active", badge: "A", color: "#1d4ed8" },
                  schedule: {
                    startDate: "2026-03-01T00:00:00.000Z",
                    endDate: "2026-03-02T00:00:00.000Z",
                    missingBoundary: null
                  },
                  details: { mappedId: "WI-1" }
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
            activeMappingProfileId: "profile-a"
          }
        })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const first = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
    });

    const second = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
    });

    const dismissed = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      dismissStrictFailWarning: true
    });

    expect(first.uiState).toBe("ready");
    expect(second.success).toBe(true);
    expect(second.uiState).toBe("ready_with_lkg_warning");
    expect(second.lastRefreshAt).toBe("2026-03-04T20:00:00.000Z");
    expect(second.strictFail.active).toBe(true);
    expect(second.view).toContain("[WARN] Strict-fail fallback active");
    expect(second.view).toContain("- Action: Retry now");
    expect(second.view).toContain("Timeline details (mapped ID):");
    expect(second.view).toContain("UI state: ready_with_lkg_warning");
    expect(dismissed.view).not.toContain("[WARN] Strict-fail fallback active");
  });

  it("REL-01: no successful load and runtime failure yields query_failure without fake LKG", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const controller = new QueryIntakeController(
      store,
      {
        execute: vi.fn(async () => {
          throw new Error("QUERY_EXECUTION_FAILED");
        })
      } as never
    );

    const response = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=99999999-9999-4999-8999-999999999999"
    });

    expect(response.success).toBe(false);
    expect(response.uiState).toBe("query_failure");
    expect(response.strictFail.active).toBe(false);
    expect(response.timeline).toBeNull();
    expect(response.view).not.toContain("[WARN] Strict-fail fallback active");
  });

  it("REL-03: renders typical 200-item dataset with deterministic ready state and bidirectional cues", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const bars = Array.from({ length: 200 }, (_, index) => ({
      workItemId: index + 1,
      title: `Work item ${index + 1}`,
      state: { code: "Active", badge: "A", color: "#1d4ed8" },
      schedule: {
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-02T00:00:00.000Z",
        missingBoundary: null as const
      },
      details: { mappedId: `WI-${index + 1}` }
    }));

    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: "bulk",
        snapshot: {
          queryType: "flat" as const,
          workItemIds: bars.map((bar) => bar.workItemId),
          workItems: bars.map((bar) => ({ id: bar.workItemId, title: bar.title })),
          relations: [],
          hydration: {
            maxIdsPerBatch: 200,
            requestedIds: 200,
            attemptedBatches: 1,
            succeededBatches: 1,
            retriedRequests: 0,
            missingIds: [],
            partial: false,
            statusCode: "OK" as const
          }
        },
        timeline: {
          bars,
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
          activeQueryId: "bulk",
          lastRefreshAt: "2026-03-04T20:00:05.000Z",
          source: "full_reload" as const
        },
        failureCode: null,
        lastSuccessfulReload: {
          activeQueryId: "bulk",
          lastRefreshAt: "2026-03-04T20:00:05.000Z",
          source: "full_reload" as const
        },
        lastKnownGood: null
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const response = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      density: "compact"
    });

    expect(response.success).toBe(true);
    expect(response.uiState).toBe("ready");
    expect(response.workItemIds).toHaveLength(200);
    expect(response.view).toContain("Density mode: compact");
    expect(response.view).toContain("- overflow-x: auto");
    expect(response.view).toContain("- overflow-y: auto");
    expect(response.view).toContain("- bi-directional: enabled");
    expect(response.view).toContain("Timeline details (mapped ID):");
  });
});
