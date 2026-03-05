import { describe, expect, it, vi } from "vitest";

import type { AdoContext } from "../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../app/config/ado-context.store.js";
import { QueryId } from "../../domain/query-runtime/value-objects/query-id.js";
import { QueryIntakeController } from "./query-intake.controller.js";
import type { DiagnosticsPort } from "../../application/ports/diagnostics.port.js";
import { PublishDiagnosticsUseCase } from "../../application/use-cases/publish-diagnostics.use-case.js";

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
  it("returns success payload with timeline and startup-loaded active mapping profile", async () => {
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
        timeline: {
          bars: [
            {
              workItemId: 101,
              title: "Alpha delivery outcome title that is intentionally very long for ellipsis coverage",
              state: {
                code: "Active",
                badge: "A",
                color: "#1d4ed8"
              },
              schedule: {
                startDate: "2026-03-01T00:00:00.000Z",
                endDate: "2026-03-03T00:00:00.000Z",
                missingBoundary: null
              },
              details: {
                mappedId: "WI-101"
              }
            },
            {
              workItemId: 202,
              title: "Beta",
              state: {
                code: "New",
                badge: "N",
                color: "#7c3aed"
              },
              schedule: {
                startDate: null,
                endDate: "2026-03-05T00:00:00.000Z",
                missingBoundary: "start" as const
              },
              details: {
                mappedId: "WI-202"
              }
            }
          ],
          unschedulable: [
            {
              workItemId: 303,
              title: "Gamma",
              state: {
                code: "Closed",
                badge: "C",
                color: "#6b7280"
              },
              details: {
                mappedId: "WI-303"
              },
              reason: "missing-both-dates" as const
            }
          ],
          dependencies: [
            {
              predecessorWorkItemId: 101,
              successorWorkItemId: 202,
              dependencyType: "FS" as const,
              label: "#101 [end] -> #202 [start]"
            }
          ],
          suppressedDependencies: [
            {
              predecessorWorkItemId: 202,
              successorWorkItemId: 303,
              dependencyType: "FS" as const,
              reason: "unschedulable-endpoint" as const
            }
          ],
          mappingValidation: {
            status: "valid" as const,
            issues: []
          }
        },
        activeMappingProfileId: "profile-a",
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
    expect(response.activeMappingProfileId).toBe("profile-a");
    expect(response.mappingValidation).toEqual({ status: "valid", issues: [] });
    expect(response.timeline?.dependencies).toEqual([
      {
        predecessorWorkItemId: 101,
        successorWorkItemId: 202,
        dependencyType: "FS",
        label: "#101 [end] -> #202 [start]"
      }
    ]);

    expect(response.view).toContain("Timeline bars (title + state):");
    expect(response.view).toContain("#WI-101");
    expect(response.view).toContain("[A|#1d4ed8]");
    expect(response.view).toContain("[N|#7c3aed] [half-open:start]");

    expect(runQueryIntake.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mappingMutation: {
          selectProfileId: undefined,
          upsertProfile: undefined
        }
      })
    );
    expect(response.view).toContain("Unschedulable items (title + state):");
    expect(response.view).not.toContain("#303 [");
    expect(response.view).toContain("Timeline details (mapped ID):");
    expect(response.view).toContain("#101 mappedId=WI-101");
    expect(response.view).toContain("Suppressed dependencies (details only):");
    expect(response.view).toContain("#202 -> #303 (unschedulable-endpoint)");
  });

  it("returns strict mapping validation guidance and empty timeline payload when invalid", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        snapshot: {
          queryType: "flat" as const,
          workItemIds: [101],
          workItems: [{ id: 101, title: "A" }],
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
        },
        activeMappingProfileId: "profile-a",
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          lastRefreshAt: "2026-03-04T20:00:00.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.success).toBe(false);
    expect(response.trustState).toBe("needs_attention");
    expect(response.mappingValidation.status).toBe("invalid");
    expect(response.timeline?.bars).toEqual([]);
    expect(response.timeline?.dependencies).toEqual([]);
    expect(response.guidance).toContain("Fix required mapping fields before rendering timeline:");
    expect(response.view).toContain("Mapping validation:");
    expect(response.view).toContain("- status: invalid");
    expect(response.view).toContain("start [MAP_REQUIRED_BLANK]");
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
        timeline: {
          bars: [],
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

  it("wires dependency toggle from request into rendered view", async () => {
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
          workItems: [{ id: 101, title: "A" }, { id: 202, title: "B" }],
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
              predecessorWorkItemId: 101,
              successorWorkItemId: 202,
              dependencyType: "FS" as const,
              label: "#101 [end] -> #202 [start]"
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
          activeQueryId: queryId.value,
          lastRefreshAt: "2026-03-04T20:00:00.000Z",
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const hidden = await controller.submit({
      queryInput: `https://dev.azure.com/contoso/delivery/_queries/query?qid=${queryId.value}`,
      showDependencies: false
    });

    expect(hidden.view).toContain("Dependency arrows: hidden");
    expect(hidden.view).not.toContain("#101 [end] -> #202 [start]");

    const shown = await controller.submit({
      queryInput: `https://dev.azure.com/contoso/delivery/_queries/query?qid=${queryId.value}`
    });

    expect(shown.view).toContain("Dependency arrows: shown");
    expect(shown.view).toContain("#101 [end] -> #202 [start]");
  });

  it("passes mapping profile select/upsert through to use case", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        snapshot: null,
        timeline: null,
        activeMappingProfileId: "profile-b",
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          lastRefreshAt: null,
          source: "full_reload" as const
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95",
      mappingProfileId: "profile-b",
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

    expect(runQueryIntake.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mappingMutation: {
          selectProfileId: "profile-b",
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
  });

  it("emits auth_failure ui state and disables session-gated controls", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "SESSION_EXPIRED" as const },
        savedQueries: [],
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        snapshot: null,
        timeline: null,
        activeMappingProfileId: null,
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          lastRefreshAt: null,
          source: "preflight_blocked" as const
        },
        failureCode: null,
        lastSuccessfulReload: null,
        lastKnownGood: null
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const response = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.uiState).toBe("auth_failure");
    expect(response.capabilities.canRefresh).toBe(false);
    expect(response.capabilities.canSwitchQuery).toBe(false);
    expect(response.capabilities.canOpenDetails).toBe(true);
    expect(response.view).toContain("[NOTICE] No active session: timeline remains read-only");
  });

  it("maps strict-fail fallback to ready_with_lkg_warning ui state", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const queryId = QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95");
    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: queryId.value,
        snapshot: null,
        timeline: null,
        activeMappingProfileId: "profile-a",
        reload: {
          runVersion: 2,
          stale: false,
          activeQueryId: queryId.value,
          lastRefreshAt: null,
          source: "full_reload" as const
        },
        failureCode: "QUERY_EXECUTION_FAILED",
        lastSuccessfulReload: {
          activeQueryId: queryId.value,
          lastRefreshAt: "2026-03-04T20:00:00.000Z",
          source: "full_reload" as const
        },
        lastKnownGood: {
          selectedQueryId: queryId.value,
          snapshot: {
            queryType: "flat" as const,
            workItemIds: [101],
            workItems: [{ id: 101, title: "A" }],
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
                workItemId: 101,
                title: "A",
                state: {
                  code: "Active",
                  badge: "A",
                  color: "#1d4ed8"
                },
                schedule: {
                  startDate: "2026-03-01T00:00:00.000Z",
                  endDate: "2026-03-02T00:00:00.000Z",
                  missingBoundary: null
                },
                details: {
                  mappedId: "WI-101"
                }
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
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);
    const response = await controller.submit({
      queryInput: `https://dev.azure.com/contoso/delivery/_queries/query?qid=${queryId.value}`
    });

    expect(response.uiState).toBe("ready_with_lkg_warning");
    expect(response.strictFail.active).toBe(true);
    expect(response.view).toContain("[WARN] Strict-fail fallback active");
    expect(response.view).toContain("UI state: ready_with_lkg_warning");
  });

  it("publishes diagnostics event for successful intake outcome", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const queryId = QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95");
    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "READY" as const },
        savedQueries: [],
        selectedQueryId: queryId.value,
        snapshot: {
          queryType: "flat" as const,
          workItemIds: [101],
          workItems: [{ id: 101, title: "A" }],
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
            status: "valid" as const,
            issues: []
          }
        },
        activeMappingProfileId: "profile-a",
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: queryId.value,
          lastRefreshAt: "2026-03-04T20:00:00.000Z",
          source: "full_reload" as const
        },
        failureCode: null,
        lastSuccessfulReload: {
          activeQueryId: queryId.value,
          lastRefreshAt: "2026-03-04T20:00:00.000Z",
          source: "full_reload" as const
        },
        lastKnownGood: null
      }))
    };

    const diagnosticsPort: DiagnosticsPort = {
      publish: vi.fn(async () => undefined)
    };
    const publishDiagnostics = new PublishDiagnosticsUseCase(diagnosticsPort);

    const controller = new QueryIntakeController(
      store,
      runQueryIntake as never,
      publishDiagnostics
    );

    await controller.submit({
      queryInput: `https://dev.azure.com/contoso/delivery/_queries/query?qid=${queryId.value}`
    });

    expect(diagnosticsPort.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: "OK",
        errorCode: null,
        source: expect.objectContaining({
          component: "query-intake",
          activeQueryId: queryId.value,
          selectedQueryId: queryId.value,
          reloadSource: "full_reload"
        })
      })
    );
  });

  it("publishes diagnostics event for auth failure path", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "SESSION_EXPIRED" as const },
        savedQueries: [],
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        snapshot: null,
        timeline: null,
        activeMappingProfileId: null,
        reload: {
          runVersion: 1,
          stale: false,
          activeQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          lastRefreshAt: null,
          source: "preflight_blocked" as const
        },
        failureCode: null,
        lastSuccessfulReload: null,
        lastKnownGood: null
      }))
    };

    const diagnosticsPort: DiagnosticsPort = {
      publish: vi.fn(async () => undefined)
    };
    const publishDiagnostics = new PublishDiagnosticsUseCase(diagnosticsPort);

    const controller = new QueryIntakeController(
      store,
      runQueryIntake as never,
      publishDiagnostics
    );

    await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(diagnosticsPort.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: "SESSION_EXPIRED",
        errorCode: null,
        source: expect.objectContaining({
          preflightStatus: "SESSION_EXPIRED",
          uiState: "auth_failure"
        })
      })
    );
  });
});
