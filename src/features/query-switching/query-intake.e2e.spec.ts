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
  it("covers happy path URL intake to IDs and predecessor-successor arrows", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));

    const runQueryIntake = {
      execute: vi.fn(async ({ context }) => ({
        preflight: { status: "READY" as const },
        savedQueries: [
          {
            id: context.queryId.value,
            name: "Delivery Timeline",
            path: "Shared Queries/Delivery Timeline"
          }
        ],
        selectedQueryId: context.queryId.value,
        snapshot: {
          workItemIds: [1001, 1002],
          relations: [
            {
              type: "System.LinkTypes.Dependency-Forward" as const,
              sourceId: 1001,
              targetId: 1002
            }
          ]
        }
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const result = await controller.submit({
      queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(result.success).toBe(true);
    expect(result.preflightStatus).toBe("READY");
    expect(result.selectedQueryId).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
    expect(result.workItemIds).toEqual([1001, 1002]);
    expect(result.relations).toEqual([
      {
        type: "System.LinkTypes.Dependency-Forward",
        sourceId: 1001,
        targetId: 1002
      }
    ]);
    expect(result.fsArrows).toEqual([
      {
        predecessorId: 1001,
        successorId: 1002,
        label: "#1001 [end] -> #1002 [start]"
      }
    ]);

    expect(result.savedQueries[0]).toEqual({
      id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
      name: "Delivery Timeline",
      path: "Shared Queries/Delivery Timeline"
    });
    expect(result.view).toContain("Dependencies (FS arrows: predecessor end -> successor start):");
    expect(result.view).toContain("#1001 [end] -> #1002 [start]");
  });

  it("covers auth gate path and blocks fabricated result payload", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async ({ context }) => ({
        preflight: { status: "SESSION_EXPIRED" as const },
        savedQueries: [],
        selectedQueryId: context.queryId.value,
        snapshot: null
      }))
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const result = await controller.submit({
      queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(result.success).toBe(false);
    expect(result.preflightStatus).toBe("SESSION_EXPIRED");
    expect(result.guidance).toBe("Session expired. Sign in to Azure and retry.");
    expect(result.workItemIds).toEqual([]);
    expect(result.relations).toEqual([]);
    expect(result.fsArrows).toEqual([]);
  });

  it("covers missing query path with short guidance and no fake data", async () => {
    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const runQueryIntake = {
      execute: vi.fn(async () => {
        throw new Error("QUERY_NOT_FOUND");
      })
    };

    const controller = new QueryIntakeController(store, runQueryIntake as never);

    const result = await controller.submit({
      queryInput: "37f6f880-0b7b-4350-9f97-7263b40d4e95"
    });

    expect(result.success).toBe(false);
    expect(result.guidance).toBe("Query not found. Confirm query ID and try again.");
    expect(result.workItemIds).toEqual([]);
    expect(result.relations).toEqual([]);
    expect(result.fsArrows).toEqual([]);
  });
});
