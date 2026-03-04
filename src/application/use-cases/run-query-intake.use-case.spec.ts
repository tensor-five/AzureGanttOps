import { describe, expect, it, vi } from "vitest";

import type { AuthPreflightPort } from "../ports/auth-preflight.port.js";
import type { QueryRuntimePort } from "../ports/query-runtime.port.js";
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

  it("runs full reload path with version metadata", async () => {
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

    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime);
    const result = await useCase.execute({ context: contextA });

    expect(order).toEqual(["preflight", "list", "execute"]);
    expect(result.preflight.status).toBe("READY");
    expect(result.selectedQueryId).toBe(contextA.queryId.value);
    expect(result.snapshot?.workItemIds).toEqual([101]);
    expect(result.reload.runVersion).toBe(1);
    expect(result.reload.stale).toBe(false);
    expect(result.reload.activeQueryId).toBe(contextA.queryId.value);
    expect(result.reload.source).toBe("full_reload");
    expect(result.reload.lastRefreshAt).not.toBeNull();
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

    expect(result).toEqual({
      preflight: { status: "SESSION_EXPIRED" },
      savedQueries: [],
      selectedQueryId: contextA.queryId.value,
      snapshot: null,
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
      executeByQueryId: vi.fn(async (queryId: string) => {
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
    expect(firstRunResult.reload.runVersion).toBe(1);
    expect(firstRunResult.reload.stale).toBe(true);
    expect(firstRunResult.reload.activeQueryId).toBe(queryB.value);
    expect(firstRunResult.reload.source).toBe("stale_discarded");
    expect(firstRunResult.reload.lastRefreshAt).toBeNull();
  });
});
