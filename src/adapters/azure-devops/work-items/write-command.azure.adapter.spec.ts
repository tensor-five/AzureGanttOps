import { describe, expect, it, vi } from "vitest";

import type { AdoContext } from "../../../application/ports/context-settings.port.js";
import { WriteCommandAzureAdapter } from "./write-command.azure.adapter.js";

function createContextStore(context: AdoContext | null): { getActiveContext: () => Promise<AdoContext | null> } {
  return {
    getActiveContext: vi.fn(async () => context)
  };
}

describe("WriteCommandAzureAdapter", () => {
  it("submits work item patch commands to the expected endpoint", async () => {
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_PATCH",
      workItemId: 42,
      operations: [{ op: "add", path: "/fields/System.Title", value: "Updated" }]
    });

    expect(result).toEqual({
      accepted: true,
      mode: "EXECUTED",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 1,
      reasonCode: "WRITE_ENABLED"
    });
    expect(patch).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/42?api-version=7.1",
      [{ op: "add", path: "/fields/System.Title", value: "Updated" }],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });

  it("submits dependency-link add commands as relation patches on source work item", async () => {
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "DEPENDENCY_LINK",
      sourceId: 1001,
      targetId: 1002,
      relation: "System.LinkTypes.Dependency-Forward",
      action: "add"
    });

    expect(result).toEqual({
      accepted: true,
      mode: "EXECUTED",
      commandKind: "DEPENDENCY_LINK",
      operationCount: 1,
      reasonCode: "WRITE_ENABLED"
    });
    expect(patch).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/1001?api-version=7.1",
      [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "System.LinkTypes.Dependency-Forward",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/1002"
          }
        }
      ],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });

  it("removes dependency-link by relation index lookup when action is remove", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/2001"
          },
          {
            rel: "System.LinkTypes.Dependency-Forward",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/1002"
          }
        ]
      }
    }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "DEPENDENCY_LINK",
      sourceId: 1001,
      targetId: 1002,
      relation: "System.LinkTypes.Dependency-Forward",
      action: "remove"
    });

    expect(result).toEqual({
      accepted: true,
      mode: "EXECUTED",
      commandKind: "DEPENDENCY_LINK",
      operationCount: 1,
      reasonCode: "WRITE_ENABLED"
    });
    expect(get).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/1001?$expand=relations&api-version=7.1",
      { accept: "application/json" }
    );
    expect(patch).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/1001?api-version=7.1",
      [{ op: "remove", path: "/relations/1" }],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });
});
