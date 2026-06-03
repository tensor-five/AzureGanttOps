import { describe, expect, it, vi } from "vitest";

import { fetchAvailableWorkItemTypes } from "./http-server-query-resolvers.js";
import type { AdoContextStore } from "../config/ado-context.store.js";
import type { HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";

describe("fetchAvailableWorkItemTypes", () => {
  it("loads planning work item type names sorted and deduplicated", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        taskBacklog: {
          workItemTypes: [
            { name: "Task" }
          ]
        },
        requirementBacklog: {
          workItemTypes: [
            { name: " feature " },
            { name: "Feature" },
            { name: " " },
            {}
          ]
        },
        portfolioBacklogs: [
          {
            workItemTypes: [
              { name: "Bug" }
            ]
          }
        ]
      },
      headers: {}
    }));

    const result = await fetchAvailableWorkItemTypes({
      contextStore: makeContextStore(),
      httpClient: { get } satisfies HttpClient
    });

    expect(result).toEqual([
      { name: "Bug" },
      { name: "feature" },
      { name: "Task" }
    ]);
    expect(get).toHaveBeenCalledWith("https://dev.azure.com/contoso/delivery/_apis/work/processconfiguration?api-version=7.1");
  });

  it("throws a stable error for failed Azure responses", async () => {
    await expect(
      fetchAvailableWorkItemTypes({
        contextStore: makeContextStore(),
        httpClient: {
          get: async () => ({
            status: 503,
            json: {},
            headers: {}
          })
        }
      })
    ).rejects.toThrow("WORK_ITEM_TYPES_FETCH_FAILED:503");
  });
});

function makeContextStore(): AdoContextStore {
  return {
    getActiveContext: async () => ({
      organization: "contoso",
      project: "delivery"
    })
  } as AdoContextStore;
}
