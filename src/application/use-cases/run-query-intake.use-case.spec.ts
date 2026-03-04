import { describe, expect, it, vi } from "vitest";

import type { AuthPreflightPort } from "../ports/auth-preflight.port.js";
import type { QueryRuntimePort } from "../ports/query-runtime.port.js";
import { QueryId } from "../../domain/query-runtime/value-objects/query-id.js";
import { RunQueryIntakeUseCase } from "./run-query-intake.use-case.js";

describe("RunQueryIntakeUseCase", () => {
  const context = {
    organization: "contoso",
    project: "delivery",
    queryId: QueryId.create("37f6f880-0b7b-4350-9f97-7263b40d4e95")
  };

  it("runs preflight before listing and execution", async () => {
    const order: string[] = [];
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => {
        order.push("preflight");
        return { status: "READY" };
      })
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => {
        order.push("list");
        return [{ id: context.queryId.value, name: "Delivery Timeline", path: "Shared Queries/Delivery Timeline" }];
      }),
      executeByQueryId: vi.fn(async () => {
        order.push("execute");
        return { workItemIds: [101], relations: [] };
      })
    };

    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime);

    const result = await useCase.execute({ context });

    expect(order).toEqual(["preflight", "list", "execute"]);
    expect(result.preflight.status).toBe("READY");
    expect(result.selectedQueryId).toBe(context.queryId.value);
    expect(result.snapshot?.workItemIds).toEqual([101]);
  });

  it("blocks list and execution when preflight is not READY", async () => {
    const authPreflight: AuthPreflightPort = {
      check: vi.fn(async () => ({ status: "SESSION_EXPIRED" }))
    };

    const queryRuntime: QueryRuntimePort = {
      listSavedQueries: vi.fn(async () => []),
      executeByQueryId: vi.fn(async () => ({ workItemIds: [], relations: [] }))
    };

    const useCase = new RunQueryIntakeUseCase(authPreflight, queryRuntime);

    const result = await useCase.execute({ context });

    expect(result).toEqual({
      preflight: { status: "SESSION_EXPIRED" },
      savedQueries: [],
      selectedQueryId: context.queryId.value,
      snapshot: null
    });

    expect(queryRuntime.listSavedQueries).not.toHaveBeenCalled();
    expect(queryRuntime.executeByQueryId).not.toHaveBeenCalled();
  });
});
