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
  it("returns success payload with ids and FS arrows on READY flow", async () => {
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
          workItemIds: [101, 202],
          relations: [
            {
              type: "System.LinkTypes.Dependency-Forward" as const,
              sourceId: 101,
              targetId: 202
            }
          ]
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.success).toBe(true);
    expect(response.preflightStatus).toBe("READY");
    expect(response.workItemIds).toEqual([101, 202]);
    expect(response.fsArrows).toEqual([
      {
        predecessorId: 101,
        successorId: 202,
        label: "#101 [end] -> #202 [start]"
      }
    ]);
    expect(response.view).toContain("[OK] Ready");
  });

  it("returns short action guidance for non-ready preflight", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async () => ({
        preflight: { status: "SESSION_EXPIRED" as const },
        savedQueries: [],
        selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        snapshot: null
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.success).toBe(false);
    expect(response.guidance).toBe("Session expired. Sign in to Azure and retry.");
    expect(response.workItemIds).toEqual([]);
    expect(response.relations).toEqual([]);
  });

  it("returns focused query failure guidance and no fake data", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async () => {
        throw new Error("QUERY_NOT_FOUND");
      })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const response = await controller.submit({
      queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(response.success).toBe(false);
    expect(response.guidance).toBe("Query not found. Confirm query ID and try again.");
    expect(response.workItemIds).toEqual([]);
    expect(response.relations).toEqual([]);
  });
});
