import { describe, expect, it, vi } from "vitest";

import { type AdoContext } from "../../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";
import type { HttpClient } from "../queries/azure-query-runtime.adapter.js";
import { AzureIterationsAdapter } from "./azure-iterations.adapter.js";

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

describe("AzureIterationsAdapter", () => {
  it("flattens the classification nodes tree into iteration metadata with full paths", async () => {
    const client = makeClient(() => ({
      status: 200,
      json: {
        name: "ProjectA",
        identifier: "root",
        attributes: {},
        children: [
          {
            name: "Release 1",
            identifier: "rel-1",
            attributes: {},
            children: [
              {
                name: "Sprint 1",
                identifier: "sprint-1",
                attributes: {
                  startDate: "2026-03-01T00:00:00Z",
                  finishDate: "2026-03-14T00:00:00Z"
                }
              }
            ]
          }
        ]
      }
    }));

    const iterations = await makeAdapter(client).listIterations();

    expect(iterations).toEqual([
      {
        id: "root",
        name: "ProjectA",
        path: "ProjectA",
        startDate: null,
        endDate: null
      },
      {
        id: "rel-1",
        name: "Release 1",
        path: "ProjectA\\Release 1",
        startDate: null,
        endDate: null
      },
      {
        id: "sprint-1",
        name: "Sprint 1",
        path: "ProjectA\\Release 1\\Sprint 1",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-14T00:00:00.000Z"
      }
    ]);
  });

  it("retries transient 429 responses before returning success", async () => {
    vi.useFakeTimers();
    try {
      const responses = [
        { status: 429, json: null },
        { status: 429, json: null },
        { status: 200, json: { name: "ProjectA", identifier: "root", children: [] } }
      ];
      const get = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));

      const promise = makeAdapter({ get }).listIterations();
      void promise.catch(() => undefined);
      await vi.runAllTimersAsync();
      const iterations = await promise;

      expect(get).toHaveBeenCalledTimes(3);
      expect(iterations).toEqual([
        { id: "root", name: "ProjectA", path: "ProjectA", startDate: null, endDate: null }
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry on 4xx client errors and surfaces a coded failure", async () => {
    const get = vi.fn().mockResolvedValue({ status: 401, json: null });

    await expect(makeAdapter({ get }).listIterations()).rejects.toThrow("ITERATIONS_LIST_FAILED:HTTP_401");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("surfaces a transport failure when the http client throws repeatedly", async () => {
    vi.useFakeTimers();
    try {
      const get = vi.fn().mockRejectedValue(new Error("network-down"));

      const promise = makeAdapter({ get }).listIterations();
      void promise.catch(() => undefined);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("ITERATIONS_LIST_FAILED:network-down");
      expect(get.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails fast when no active context is available", async () => {
    const store = new AdoContextStore(new InMemoryContextSettings(null));
    const adapter = new AzureIterationsAdapter(makeClient(() => ({ status: 200, json: null })), store);

    await expect(adapter.listIterations()).rejects.toThrow("NO_CONTEXT");
  });
});

function makeAdapter(client: HttpClient): AzureIterationsAdapter {
  const store = new AdoContextStore(new InMemoryContextSettings({ organization: "contoso", project: "delivery" }));
  return new AzureIterationsAdapter(client, store);
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
