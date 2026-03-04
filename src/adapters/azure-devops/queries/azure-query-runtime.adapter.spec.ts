import { describe, expect, it } from "vitest";

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

    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const adapter = new AzureQueryRuntimeAdapter(client, store);

    await expect(adapter.listSavedQueries()).resolves.toEqual([
      {
        id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
        name: "Delivery Timeline",
        path: "Shared Queries/Delivery Timeline"
      }
    ]);
  });

  it("executes query by ID and returns IDs with dependency relations", async () => {
    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            workItems: [{ id: 101 }, { id: 202 }],
            workItemRelations: [
              {
                rel: "System.LinkTypes.Dependency-Forward",
                source: { id: 101 },
                target: { id: 202 }
              },
              {
                rel: "System.LinkTypes.Hierarchy-Forward",
                source: { id: 1 },
                target: { id: 2 }
              }
            ]
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const adapter = new AzureQueryRuntimeAdapter(client, store);

    await expect(
      adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95")
    ).resolves.toEqual({
      workItemIds: [101, 202],
      relations: [
        {
          type: "System.LinkTypes.Dependency-Forward",
          sourceId: 101,
          targetId: 202
        }
      ]
    });
  });

  it("maps 404 query execution to QUERY_NOT_FOUND", async () => {
    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 404,
          json: {
            message: "Query does not exist"
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const adapter = new AzureQueryRuntimeAdapter(client, store);

    await expect(
      adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95")
    ).rejects.toThrow("QUERY_NOT_FOUND");
  });

  it("maps malformed payload to MALFORMED_PAYLOAD", async () => {
    const client = makeClient((url) => {
      if (url.includes("/_apis/wit/wiql/")) {
        return {
          status: 200,
          json: {
            workItems: [{ id: "bad" }]
          }
        };
      }

      throw new Error(`unexpected url ${url}`);
    });

    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const adapter = new AzureQueryRuntimeAdapter(client, store);

    await expect(
      adapter.executeByQueryId("37f6f880-0b7b-4350-9f97-7263b40d4e95")
    ).rejects.toThrow("MALFORMED_PAYLOAD");
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

    const store = new AdoContextStore(
      new InMemoryContextSettings({ organization: "contoso", project: "delivery" })
    );

    const adapter = new AzureQueryRuntimeAdapter(client, store);

    await adapter.listSavedQueries();

    expect(calledUrls[0]).toContain("https://dev.azure.com/contoso/delivery/");
  });
});

function makeClient(resolver: (url: string) => { status: number; json: unknown }): HttpClient {
  return {
    get(url: string) {
      return Promise.resolve(resolver(url));
    }
  };
}
