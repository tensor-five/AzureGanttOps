import { describe, expect, it, vi } from "vitest";

import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";
import type { TimelineReadModel } from "../dto/timeline-read-model.js";
import type { AuthPreflightPort } from "../ports/auth-preflight.port.js";
import type { MappingSettingsPort } from "../ports/mapping-settings.port.js";
import type { QueryRuntimePort } from "../ports/query-runtime.port.js";
import type { BuildTimelineViewUseCase } from "./build-timeline-view.use-case.js";
import type { FieldMappingProfile } from "../../domain/mapping/field-mapping.js";
import { QueryId } from "../../domain/query-runtime/value-objects/query-id.js";
import { RunQueryIntakeUseCase } from "./run-query-intake.use-case.js";

describe("RunQueryIntakeUseCase", () => {
  const queryA = QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95");
  const queryB = QueryId.create("6ecf4c9d-cfbf-4f34-9093-8216d2e6d3ac");

  const contextA = {
    organization: "contoso",
    project: "delivery",
    queryId: queryA
  };

  const contextB = {
    organization: "contoso",
    project: "delivery",
    queryId: queryB
  };

  const activeProfile: FieldMappingProfile = {
    id: "profile-a",
    name: "Default",
    fields: {
      id: "Custom.ExternalId",
      title: "System.Title",
      start: "Custom.StartDate",
      endOrTarget: "Custom.TargetDate"
    }
  };

  const secondaryProfile: FieldMappingProfile = {
    id: "profile-b",
    name: "Secondary",
    fields: {
      id: "Custom.ExternalId2",
      title: "System.Title",
      start: "Custom.StartDate2",
      endOrTarget: "Custom.TargetDate2"
    }
  };

  function createTimeline(): TimelineReadModel {
    return {
      bars: [
        {
          workItemId: 101,
          title: "Alpha",
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
        status: "valid",
        issues: []
      }
    };
  }

  function createMappingSettingsStub(profiles: FieldMappingProfile[], lastActiveProfileId: string | null): MappingSettingsPort {
    return {
      loadProfiles: vi.fn(async () => profiles),
      saveProfiles: vi.fn(async () => undefined),
      getLastActiveProfileId: vi.fn(async () => lastActiveProfileId),
      setLastActiveProfileId: vi.fn(async () => undefined)
    };
  }

  it("runs full reload path with version metadata and timeline", async () => {
    const order: string[] = [];
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => {
        order.push("preflight");
        return { status: "READY" as const };
      })
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => {
        order.push("list");
        return [{ id: contextA.queryId.value, name: "Delivery Timeline", path: "Shared Queries/Delivery Timeline" }];
      }),
      executeByQueryId: vi.fn(async () => {
        order.push("execute");
        return {
          queryType: "flat" as const,
          workItemIds: [101],
          workItems: [{ id: 101, title: "Work item 101" }],
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
        };
      })
    };

    const buildTimelineView: BuildTimelineViewUseCase = {
      execute: vi.fn(() => createTimeline())
    } as never;

    const useCase = new RunQueryIntakeUseCase(
      authPreflight,
      queryRuntime,
      buildTimelineView,
      createMappingSettingsStub([activeProfile], "profile-a")
    );

    const result = await useCase.execute({ context: contextA });

    expect(order).toEqual(["preflight", "list", "execute"]);
    expect(result.preflight.status).toBe("READY");
    expect(result.selectedQueryId).toBe(contextA.queryId.value);
    expect(result.snapshot?.workItemIds).toEqual([101]);
    expect(result.timeline?.mappingValidation.status).toBe("valid");
    expect(result.activeMappingProfileId).toBe("profile-a");
    expect(result.reload.runVersion).toBe(1);
    expect(result.reload.stale).toBe(false);
    expect(result.reload.activeQueryId).toBe(contextA.queryId.value);
    expect(result.reload.source).toBe("full_reload");
    expect(result.reload.lastRefreshAt).not.toBeNull();
  });

  it("starts query execution in parallel with saved query loading", async () => {
    let releaseSavedQueries!: () => void;
    const executionStarts: string[] = [];

    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => {
        await new Promise<void>((resolve) => {
          releaseSavedQueries = resolve;
        });
        return [{ id: contextA.queryId.value, name: "Delivery Timeline", path: "Shared Queries/Delivery Timeline" }];
      }),
      executeByQueryId: vi.fn(async () => {
        executionStarts.push("execute-started");
        return {
          queryType: "flat" as const,
          workItemIds: [101],
          workItems: [{ id: 101, title: "Work item 101" }],
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
        };
      })
    };

    const buildTimelineView: BuildTimelineViewUseCase = {
      execute: vi.fn(() => createTimeline())
    } as never;

    const useCase = new RunQueryIntakeUseCase(
      authPreflight,
      queryRuntime,
      buildTimelineView,
      createMappingSettingsStub([activeProfile], "profile-a")
    );

    const pendingResult = useCase.execute({ context: contextA });

    await vi.waitFor(() => {
      expect(executionStarts).toEqual(["execute-started"]);
    });

    releaseSavedQueries();
    await expect(pendingResult).resolves.toMatchObject({
      preflight: { status: "READY" },
      snapshot: {
        workItemIds: [101]
      }
    });
  });

  it("auto-applies persisted last active mapping profile on first run after restart", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [101],
        workItems: [{ id: 101, title: "Work item 101" }],
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
      }))
    };

    const buildTimelineView: BuildTimelineViewUseCase = {
      execute: vi.fn(() => createTimeline())
    } as never;

    const mappingSettings = createMappingSettingsStub([activeProfile], "profile-a");

    const restartedUseCase = new RunQueryIntakeUseCase(
      authPreflight,
      queryRuntime,
      buildTimelineView,
      mappingSettings
    );

    const result = await restartedUseCase.execute({ context: contextA });

    expect(mappingSettings.loadProfiles).toHaveBeenCalledTimes(1);
    expect(mappingSettings.getLastActiveProfileId).toHaveBeenCalledTimes(1);
    expect(result.activeMappingProfileId).toBe("profile-a");
    expect(result.timeline?.mappingValidation.status).toBe("valid");
  });

  it("returns deterministic mapping gate when no active mapping profile resolves", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [101],
        workItems: [{ id: 101, title: "Work item 101" }],
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
      }))
    };

    const buildTimelineView: BuildTimelineViewUseCase = {
      execute: vi.fn(() => createTimeline())
    } as never;

    const useCase = new RunQueryIntakeUseCase(
      authPreflight,
      queryRuntime,
      buildTimelineView,
      createMappingSettingsStub([activeProfile], null)
    );

    const result = await useCase.execute({ context: contextA });

    expect(result.activeMappingProfileId).toBeNull();
    expect(result.timeline?.bars).toEqual([]);
    expect(result.timeline?.dependencies).toEqual([]);
    expect(result.timeline?.mappingValidation.status).toBe("invalid");
    expect(result.timeline?.mappingValidation.issues.map((issue) => issue.code)).toEqual([
      "MAP_REQUIRED_MISSING",
      "MAP_REQUIRED_MISSING",
      "MAP_REQUIRED_MISSING",
      "MAP_REQUIRED_MISSING"
    ]);
  });

  it("upserts mapping profile, validates it, persists profiles, and activates it", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [101],
        workItems: [{ id: 101, title: "Work item 101" }],
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
      }))
    };

    const buildTimelineView: BuildTimelineViewUseCase = {
      execute: vi.fn(() => createTimeline())
    } as never;

    const mappingSettings = createMappingSettingsStub([activeProfile], "profile-a");
    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime, buildTimelineView, mappingSettings);

    const result = await useCase.execute({
      context: contextA,
      mappingMutation: {
        upsertProfile: secondaryProfile
      }
    });

    expect(mappingSettings.saveProfiles).toHaveBeenCalledTimes(1);
    expect(mappingSettings.setLastActiveProfileId).toHaveBeenCalledWith("profile-b");
    expect(result.activeMappingProfileId).toBe("profile-b");
    expect(result.timeline?.mappingValidation.status).toBe("valid");
  });

  it("selects and persists existing mapping profile as active", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [101],
        workItems: [{ id: 101, title: "Work item 101" }],
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
      }))
    };

    const buildTimelineView: BuildTimelineViewUseCase = {
      execute: vi.fn(() => createTimeline())
    } as never;

    const mappingSettings = createMappingSettingsStub([activeProfile, secondaryProfile], "profile-a");
    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime, buildTimelineView, mappingSettings);

    const result = await useCase.execute({
      context: contextA,
      mappingMutation: {
        selectProfileId: "profile-b"
      }
    });

    expect(mappingSettings.setLastActiveProfileId).toHaveBeenCalledWith("profile-b");
    expect(result.activeMappingProfileId).toBe("profile-b");
    expect(result.timeline?.mappingValidation.status).toBe("valid");
  });

  it("throws when selecting unknown mapping profile", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [101],
        workItems: [{ id: 101, title: "Work item 101" }],
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
      }))
    };

    const useCase = new RunQueryIntakeUseCase(
      authPreflight,
      queryRuntime,
      { execute: vi.fn(() => createTimeline()) } as never,
      createMappingSettingsStub([activeProfile], "profile-a")
    );

    await expect(
      useCase.execute({
        context: contextA,
        mappingMutation: {
          selectProfileId: "missing-profile"
        }
      })
    ).rejects.toThrowError("MAP_PROFILE_NOT_FOUND");
  });

  it("throws validation error when upserting invalid mapping profile", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [101],
        workItems: [{ id: 101, title: "Work item 101" }],
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
      }))
    };

    const useCase = new RunQueryIntakeUseCase(
      authPreflight,
      queryRuntime,
      { execute: vi.fn(() => createTimeline()) } as never,
      createMappingSettingsStub([activeProfile], "profile-a")
    );

    await expect(
      useCase.execute({
        context: contextA,
        mappingMutation: {
          upsertProfile: {
            id: "profile-c",
            name: "Invalid",
            fields: {
              id: "",
              title: "System.Title",
              start: "Custom.StartDate",
              endOrTarget: "Custom.TargetDate"
            }
          }
        }
      })
    ).rejects.toThrowError("MAP_VALIDATION_FAILED");
  });

  it("re-applies persisted active profile after restart flow", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [101],
        workItems: [{ id: 101, title: "Work item 101" }],
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
      }))
    };

    const buildTimelineView: BuildTimelineViewUseCase = {
      execute: vi.fn(() => createTimeline())
    } as never;

    const mappingSettings = createMappingSettingsStub([activeProfile, secondaryProfile], "profile-a");
    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime, buildTimelineView, mappingSettings);

    await useCase.execute({
      context: contextA,
      mappingMutation: {
        selectProfileId: "profile-b"
      }
    });

    const restartedMappingSettings = createMappingSettingsStub([activeProfile, secondaryProfile], "profile-b");
    const restartedUseCase = new RunQueryIntakeUseCase(
      authPreflight,
      queryRuntime,
      buildTimelineView,
      restartedMappingSettings
    );

    const restartedResult = await restartedUseCase.execute({ context: contextA });

    expect(restartedResult.activeMappingProfileId).toBe("profile-b");
    expect(restartedResult.timeline?.mappingValidation.status).toBe("valid");
  });

  it("blocks list and execution when preflight is not READY with strict fail state", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "SESSION_EXPIRED" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({
        queryType: "flat" as const,
        workItemIds: [],
        workItems: [],
        relations: [],
        hydration: {
          maxIdsPerBatch: 200,
          requestedIds: 0,
          attemptedBatches: 0,
          succeededBatches: 0,
          retriedRequests: 0,
          missingIds: [],
          partial: false,
          statusCode: "OK" as const
        }
      }))
    };

    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime);
    const result = await useCase.execute({ context: contextA });

    expect(result).toMatchObject({
      preflight: { status: "SESSION_EXPIRED" },
      savedQueries: [],
      selectedQueryId: contextA.queryId.value,
      snapshot: null,
      timeline: null,
      activeMappingProfileId: null,
      reload: {
        runVersion: 1,
        stale: false,
        activeQueryId: contextA.queryId.value,
        lastRefreshAt: null,
        source: "preflight_blocked"
      }
    });

    expect(queryRuntime.listSavedQueries).not.toHaveBeenCalled();
    expect(queryRuntime.executeByQueryId).not.toHaveBeenCalled();
  });

  it("discards stale completion from previous query run after switch", async () => {
    let resolveFirstRun: ((value: Awaited<ReturnType<QueryRuntimePort["executeByQueryId"]>>) => void) | undefined;

    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "READY" as const }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => [
        { id: queryA.value, name: "A", path: "Shared Queries/A" },
        { id: queryB.value, name: "B", path: "Shared Queries/B" }
      ]),
      executeByQueryId: vi.fn(async (queryId: string): Promise<IngestionSnapshot> => {
        if (queryId === queryA.value) {
          return await new Promise((resolve) => {
            resolveFirstRun = resolve;
          });
        }

        return {
          queryType: "flat" as const,
          workItemIds: [202],
          workItems: [{ id: 202, title: "Work item 202" }],
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
        };
      })
    };

    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime);

    const firstRunPromise = useCase.execute({ context: contextA });
    const secondRunResult = await useCase.execute({ context: contextB });

    resolveFirstRun?.({
      queryType: "flat" as const,
      workItemIds: [101],
      workItems: [{ id: 101, title: "Work item 101" }],
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
    });

    const firstRunResult = await firstRunPromise;

    expect(secondRunResult.snapshot?.workItemIds).toEqual([202]);
    expect(secondRunResult.reload.runVersion).toBe(2);
    expect(secondRunResult.reload.stale).toBe(false);
    expect(secondRunResult.reload.activeQueryId).toBe(queryB.value);
    expect(secondRunResult.reload.source).toBe("full_reload");

    expect(firstRunResult.snapshot).toBeNull();
    expect(firstRunResult.timeline).toBeNull();
    expect(firstRunResult.reload.runVersion).toBe(1);
    expect(firstRunResult.reload.stale).toBe(true);
    expect(firstRunResult.reload.activeQueryId).toBe(queryB.value);
    expect(firstRunResult.reload.source).toBe("stale_discarded");
    expect(firstRunResult.reload.lastRefreshAt).toBeNull();
  });
});
