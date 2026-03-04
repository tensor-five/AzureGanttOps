import { describe, expect, it, vi } from "vitest";

import { type AdoContext } from "../../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";
import { AzureQueryRuntimeAdapter, type HttpClient } from "./azure-query-runtime.adapter.js";

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

describe("AzureQueryRuntimeAdapter", () => {
  it("lists saved shared queries", async () => {
    const client = makeClient((url) => {
      if (url.includes("$depth=2")) {
        return {
          status: 200,
          json: {
            value: [
              {
                id: "b52b84ee-b62f-4ea7-86cb-f8ab85f6f99a",
                name: "Shared Queries",
                isFolder: true,
                children: [
                  {
                    id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
                    name: "Delivery Timeline",
                    isFolder: false,
                    path: "Shared Queries/Delivery Timeline"
                  }
                ]
              }
            ]
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const adapter = makeAdapter(client);

    await expect(adapter.listSavedQueries()).resolves.toEqual([
      {
        id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        name: "Delivery Timeline",
        path: "Shared Queries/Delivery Timeline"
      }
    ]);
  });

  it.each([
    { totalIds: 0, expectedChunks: [] },
    { totalIds: 1, expectedChunks: [1] },
    { totalIds: 200, expectedChunks: [200] },
    { totalIds: 201, expectedChunks: [200, 1] },
    { totalIds: 400, expectedChunks: [200, 200] },
    { totalIds: 401, expectedChunks: [200, 200, 1] }
  ])("chunks hydration requests at max 200 ids (count=$totalIds)", async ({ totalIds, expectedChunks }) => {
    const ids = Array.from({ length: totalIds }, (_, index) => index + 1);
    const requestedChunkSizes: number[] = [];

    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            queryType: "flat",
            workItems: ids.map((id) => ({ id })),
            workItemRelations: []
          }
        };
      }

      if (url.includes("/_apis/wit/workitems")) {
        const chunkIds = extractIdsFromWorkItemsUrl(url);
        requestedChunkSizes.push(chunkIds.length);

        return {
          status: 200,
          json: {
            value: chunkIds.map((id) => makeHydratedItem(id))
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const adapter = makeAdapter(client);

    const snapshot = await adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95");

    expect(requestedChunkSizes).toEqual(expectedChunks);
    expect(requestedChunkSizes.every((size) => size <= 200)).toBe(true);
    expect(snapshot.workItemIds).toEqual(ids);
    expect(snapshot.workItems.map((item) => item.id)).toEqual(ids);
  });

  it("rejects non-flat query types before hydration", async () => {
    const hydrationCalls: string[] = [];

    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            queryType: "tree",
            workItems: [{ id: 101 }],
            workItemRelations: []
          }
        };
      }

      if (url.includes("/_apis/wit/workitems")) {
        hydrationCalls.push(url);
      }

      throw new Error(`unexpected url ${url}`);
    });

    const adapter = makeAdapter(client);

    await expect(adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95")).rejects.toThrow(
      "QRY_SHAPE_UNSUPPORTED"
    );

    expect(hydrationCalls).toEqual([]);
  });

  it("retries transient hydration failure then succeeds", async () => {
    vi.useFakeTimers();

    let hydrationAttempts = 0;

    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            queryType: "flat",
            workItems: [{ id: 101 }],
            workItemRelations: []
          }
        };
      }

      if (url.includes("/_apis/wit/workitems")) {
        hydrationAttempts += 1;

        if (hydrationAttempts === 1) {
          return {
            status: 503,
            json: { message: "Service unavailable" },
            headers: { "retry-after": "0" }
          };
        }

        return {
          status: 200,
          json: {
            value: [makeHydratedItem(101)]
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const adapter = makeAdapter(client);

    const execution = adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95");
    await vi.runAllTimersAsync();

    await expect(execution).resolves.toMatchObject({
      workItemIds: [101],
      workItems: [{ id: 101, title: "Work item 101" }],
      hydration: {
        retriedRequests: 1,
        statusCode: "OK"
      }
    });

    expect(hydrationAttempts).toBe(2);

    vi.useRealTimers();
  });

  it("does not retry permanent hydration failure", async () => {
    let hydrationAttempts = 0;

    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            queryType: "flat",
            workItems: [{ id: 101 }],
            workItemRelations: []
          }
        };
      }

      if (url.includes("/_apis/wit/workitems")) {
        hydrationAttempts += 1;

        return {
          status: 400,
          json: { message: "Bad request" }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const adapter = makeAdapter(client);

    await expect(adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95")).rejects.toThrow(
      "HYDRATION_REQUEST_FAILED"
    );
    expect(hydrationAttempts).toBe(1);
  });

  it("maps transient exhaustion to deterministic retry exhaustion code", async () => {
    vi.useFakeTimers();

    try {
      let hydrationAttempts = 0;

      const client = makeClient((url) => {
        if (url.includes("/_apis/wit/wiql/")) {
          return {
            status: 200,
            json: {
              queryType: "flat",
              workItems: [{ id: 101 }],
              workItemRelations: []
            }
          };
        }

        if (url.includes("/_apis/wit/workitems")) {
          hydrationAttempts += 1;

          return {
            status: 503,
            json: { message: "Service unavailable" }
          };
        }

        throw new Error(`unexpected url ${url}`);
      });

      const adapter = makeAdapter(client);

      const execution = adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95");
      void execution.catch(() => undefined);

      await vi.runAllTimersAsync();

      await expect(execution).rejects.toThrow("HYDRATION_TRANSIENT_RETRY_EXHAUSTED");
      expect(hydrationAttempts).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves dependency and hierarchy relation direction in normalized output", async () => {
    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            queryType: "flat",
            workItems: [{ id: 101 }, { id: 202 }, { id: 303 }],
            workItemRelations: [
              {
                rel: "System.LinkTypes.Dependency-Forward",
                source: { id: 101 },
                target: { id: 202 }
              },
              {
                rel: "System.LinkTypes.Dependency-Reverse",
                source: { id: 202 },
                target: { id: 101 }
              },
              {
                rel: "System.LinkTypes.Hierarchy-Forward",
                source: { id: 101 },
                target: { id: 303 }
              },
              {
                rel: "System.LinkTypes.Hierarchy-Reverse",
                source: { id: 303 },
                target: { id: 101 }
              }
            ]
          }
        };
      }

      if (url.includes("/_apis/wit/workitems")) {
        const chunkIds = extractIdsFromWorkItemsUrl(url);

        return {
          status: 200,
          json: {
            value: chunkIds.map((id) => makeHydratedItem(id))
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const adapter = makeAdapter(client);

    await expect(adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95")).resolves.toMatchObject({
      relations: [
        {
          type: "System.LinkTypes.Dependency-Forward",
          sourceId: 101,
          targetId: 202
        },
        {
          type: "System.LinkTypes.Dependency-Reverse",
          sourceId: 202,
          targetId: 101
        },
        {
          type: "System.LinkTypes.Hierarchy-Forward",
          sourceId: 101,
          targetId: 303
        },
        {
          type: "System.LinkTypes.Hierarchy-Reverse",
          sourceId: 303,
          targetId: 101
        }
      ]
    });
  });

  it("reports partial hydration when Azure omits requested ids", async () => {
    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            queryType: "flat",
            workItems: [{ id: 101 }, { id: 202 }],
            workItemRelations: []
          }
        };
      }

      if (url.includes("/_apis/wit/workitems")) {
        return {
          status: 200,
          json: {
            value: [makeHydratedItem(101)]
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const adapter = makeAdapter(client);

    await expect(adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95")).resolves.toMatchObject({
      workItemIds: [101, 202],
      workItems: [{ id: 101, title: "Work item 101" }],
      hydration: {
        partial: true,
        statusCode: "HYDRATION_PARTIAL_FAILURE",
        missingIds: [202]
      }
    });
  });

  it("uses active stored context by default", async () => {
    const calledUrls: string[] = [];
    const client = makeClient((url) => {
      calledUrls.push(url);
      return {
        status: 200,
        json: {
          value: []
        }
      };
    });

    const adapter = makeAdapter(client);

    await adapter.listSavedQueries();

    expect(calledUrls[0]).toContain("https://dev.azure.com/contoso/delivery/");
  });
});

function makeAdapter(client: HttpClient): AzureQueryRuntimeAdapter {
  const store = new AdoContextStore(new InMemoryContextSettings({ organization: "contoso", project: "delivery" }));
  return new AzureQueryRuntimeAdapter(client, store);
}

function makeClient(
  resolver: (url: string) => { status: number; json: unknown; headers?: Record<string, string | undefined> }
): HttpClient {
  return {
    get(url: string) {
      return Promise.resolve(resolver(url));
    }
  };
}

function extractIdsFromWorkItemsUrl(rawUrl: string): number[] {
  const url = new URL(rawUrl);
  const ids = url.searchParams.get("ids") ?? "";

  if (!ids) {
    return [];
  }

  return ids
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
}

function makeHydratedItem(id: number): { id: number; fields: { "System.Title": string } } {
  return {
    id,
    fields: {
      "System.Title": `Work item ${id}`
    }
  };
}
