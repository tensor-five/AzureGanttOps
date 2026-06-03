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

  it("duplicates work items with title, description, tags, assignment, paths, schedule dates, and parent relation", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.Title": "Original",
          "System.Description": "<p>Details</p>",
          "System.WorkItemType": "User Story",
          "System.Tags": "alpha; beta",
          "System.AssignedTo": "Ada Lovelace <ada@example.com>",
          "System.AreaPath": "delivery\\Platform",
          "System.IterationPath": "delivery\\Sprint 1",
          "Microsoft.VSTS.Scheduling.StartDate": "2026-03-01T00:00:00.000Z",
          "Microsoft.VSTS.Scheduling.TargetDate": "2026-03-03T00:00:00.000Z"
        },
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/99"
          }
        ]
      }
    }));
    const post = vi.fn(async () => ({ status: 200, json: { id: 1234 } }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_DUPLICATE",
      sourceWorkItemId: 42
    });

    expect(result).toEqual({
      accepted: true,
      mode: "EXECUTED",
      commandKind: "WORK_ITEM_DUPLICATE",
      operationCount: 9,
      reasonCode: "WRITE_ENABLED",
      createdWorkItemId: 1234
    });
    expect(get).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/42?$expand=relations&api-version=7.1",
      { accept: "application/json" }
    );
    expect(post).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/$User%20Story?api-version=7.1",
      [
        { op: "add", path: "/fields/System.Title", value: "Original (copy)" },
        { op: "add", path: "/fields/System.Description", value: "<p>Details</p>" },
        { op: "add", path: "/fields/System.Tags", value: "alpha; beta" },
        { op: "add", path: "/fields/System.AssignedTo", value: "Ada Lovelace <ada@example.com>" },
        { op: "add", path: "/fields/System.AreaPath", value: "delivery\\Platform" },
        { op: "add", path: "/fields/System.IterationPath", value: "delivery\\Sprint 1" },
        {
          op: "add",
          path: "/fields/Microsoft.VSTS.Scheduling.StartDate",
          value: "2026-03-01T00:00:00.000Z"
        },
        {
          op: "add",
          path: "/fields/Microsoft.VSTS.Scheduling.TargetDate",
          value: "2026-03-03T00:00:00.000Z"
        },
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/99"
          }
        }
      ],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });

  it("duplicates schedule fields from the active mapping when they are present", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.Title": "Original",
          "System.WorkItemType": "Task",
          "Custom.StartDate": "2026-01-01",
          "Custom.StartDate2": "2026-04-01",
          "Custom.TargetDate2": "2026-04-08"
        }
      }
    }));
    const post = vi.fn(async () => ({ status: 200, json: { id: 1234 } }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_DUPLICATE",
      sourceWorkItemId: 42,
      scheduleFieldRefs: {
        start: "Custom.StartDate2",
        endOrTarget: "Custom.TargetDate2"
      }
    });

    expect(result).toMatchObject({
      accepted: true,
      commandKind: "WORK_ITEM_DUPLICATE",
      operationCount: 3,
      createdWorkItemId: 1234
    });
    expect(post).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/$Task?api-version=7.1",
      [
        { op: "add", path: "/fields/System.Title", value: "Original (copy)" },
        { op: "add", path: "/fields/Custom.StartDate2", value: "2026-04-01" },
        { op: "add", path: "/fields/Custom.TargetDate2", value: "2026-04-08" }
      ],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });

  it("returns created work item fields from Azure create responses for local timeline reconciliation", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.Title": "Original",
          "System.WorkItemType": "Task",
          "Custom.StartDate2": "2026-04-01",
          "Custom.TargetDate2": "2026-04-08"
        }
      }
    }));
    const post = vi.fn(async () => ({
      status: 200,
      json: {
        id: 1234,
        fields: {
          "System.Title": "Original (copy)",
          "System.State": "New",
          "System.WorkItemType": "Task",
          "System.AssignedTo": {
            uniqueName: "ada@example.com"
          },
          "Custom.StartDate2": "2026-04-01",
          "Custom.TargetDate2": "2026-04-08"
        },
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/99"
          }
        ]
      }
    }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_DUPLICATE",
      sourceWorkItemId: 42,
      scheduleFieldRefs: {
        start: "Custom.StartDate2",
        endOrTarget: "Custom.TargetDate2"
      }
    });

    expect(result.createdWorkItem).toEqual({
      id: 1234,
      title: "Original (copy)",
      state: "New",
      descriptionHtml: null,
      workItemType: "Task",
      assignedTo: "ada@example.com",
      fieldValues: {
        "System.Title": "Original (copy)",
        "System.State": "New",
        "System.WorkItemType": "Task",
        "Custom.StartDate2": "2026-04-01",
        "Custom.TargetDate2": "2026-04-08"
      },
      parentWorkItemId: 99,
      schedule: {
        startDate: "2026-04-01",
        endDate: "2026-04-08"
      }
    });
  });

  it("creates child work items from the server-side parent type mapping", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.Title": "Parent feature",
          "System.WorkItemType": "Feature",
          "System.AreaPath": "delivery\\Platform",
          "System.IterationPath": "delivery\\Sprint 2"
        }
      }
    }));
    const post = vi.fn(async () => ({
      status: 200,
      json: {
        id: 5678,
        fields: {
          "System.Title": "Draft story",
          "System.State": "New",
          "System.WorkItemType": "User Story",
          "Custom.StartDate2": "2026-04-01",
          "Custom.TargetDate2": "2026-04-08"
        }
      }
    }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_CHILD_CREATE",
      parentWorkItemId: 42,
      title: " Draft story ",
      scheduleFieldRefs: {
        start: "Custom.StartDate2",
        endOrTarget: "Custom.TargetDate2"
      }
    });

    expect(result).toEqual({
      accepted: true,
      mode: "EXECUTED",
      commandKind: "WORK_ITEM_CHILD_CREATE",
      operationCount: 4,
      reasonCode: "WRITE_ENABLED",
      createdWorkItemId: 5678,
      createdWorkItem: {
        id: 5678,
        title: "Draft story",
        state: "New",
        descriptionHtml: null,
        workItemType: "User Story",
        assignedTo: null,
        fieldValues: {
          "System.Title": "Draft story",
          "System.State": "New",
          "System.WorkItemType": "User Story",
          "Custom.StartDate2": "2026-04-01",
          "Custom.TargetDate2": "2026-04-08"
        },
        parentWorkItemId: 42,
        schedule: {
          startDate: "2026-04-01",
          endDate: "2026-04-08"
        }
      }
    });
    expect(get).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/42?api-version=7.1",
      { accept: "application/json" }
    );
    expect(post).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/$User%20Story?api-version=7.1",
      [
        { op: "add", path: "/fields/System.Title", value: "Draft story" },
        { op: "add", path: "/fields/System.AreaPath", value: "delivery\\Platform" },
        { op: "add", path: "/fields/System.IterationPath", value: "delivery\\Sprint 2" },
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/42"
          }
        }
      ],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });

  it("uses a default child title when the child-create command omits one", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.WorkItemType": "EpicPPM"
        }
      }
    }));
    const post = vi.fn(async () => ({ status: 200, json: { id: 5678 } }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_CHILD_CREATE",
      parentWorkItemId: 42
    });

    expect(result).toMatchObject({
      accepted: true,
      commandKind: "WORK_ITEM_CHILD_CREATE",
      operationCount: 2,
      createdWorkItemId: 5678,
      createdWorkItem: {
        id: 5678,
        parentWorkItemId: 42
      }
    });
    expect(post).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/$Feature?api-version=7.1",
      [
        { op: "add", path: "/fields/System.Title", value: "New Feature" },
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/42"
          }
        }
      ],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });

  it("returns child-create as unsupported for parent types without a child mapping and does not POST", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.WorkItemType": "Task"
        }
      }
    }));
    const post = vi.fn(async () => ({ status: 200, json: { id: 5678 } }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_CHILD_CREATE",
      parentWorkItemId: 42
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_CHILD_CREATE",
      operationCount: 0,
      reasonCode: "WORK_ITEM_CHILD_TYPE_UNSUPPORTED"
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("reports child-create as unsupported when GET or POST transport is unavailable", async () => {
    const get = vi.fn(async () => ({ status: 200, json: {}, headers: {} }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_CHILD_CREATE",
      parentWorkItemId: 42
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_CHILD_CREATE",
      operationCount: 1,
      reasonCode: "WRITE_UNSUPPORTED"
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("includes Azure child-create parent fetch and creation error details", async () => {
    const get = vi.fn(async (): Promise<{ status: number; json: unknown }> => ({
      status: 400,
      json: {
        message: "TF401232: Work item does not exist."
      }
    }));
    const post = vi.fn(async (): Promise<{ status: number; json: unknown }> => ({ status: 200, json: { id: 5678 } }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    await expect(
      adapter.submit({
        kind: "WORK_ITEM_CHILD_CREATE",
        parentWorkItemId: 42
      })
    ).rejects.toThrow("WORK_ITEM_CHILD_PARENT_FETCH_FAILED: TF401232: Work item does not exist.");
    expect(post).not.toHaveBeenCalled();

    get.mockResolvedValueOnce({
      status: 200,
      json: {
        fields: {
          "System.WorkItemType": "Feature"
        }
      }
    });
    post.mockResolvedValueOnce({
      status: 400,
      json: {
        message: "TF401320: Rule Error for field Custom.Required."
      }
    });

    await expect(
      adapter.submit({
        kind: "WORK_ITEM_CHILD_CREATE",
        parentWorkItemId: 42
      })
    ).rejects.toThrow("WORK_ITEM_CHILD_CREATE_FAILED: TF401320: Rule Error for field Custom.Required.");
  });

  it("duplicates assigned identity objects by unique name", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.Title": "Original",
          "System.WorkItemType": "Task",
          "System.AssignedTo": {
            displayName: "Ada Lovelace",
            uniqueName: "ada@example.com"
          }
        }
      }
    }));
    const post = vi.fn(async () => ({ status: 200, json: { id: 1234 } }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_DUPLICATE",
      sourceWorkItemId: 42
    });

    expect(result).toMatchObject({
      accepted: true,
      commandKind: "WORK_ITEM_DUPLICATE",
      operationCount: 2,
      createdWorkItemId: 1234
    });
    expect(post).toHaveBeenCalledWith(
      "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/$Task?api-version=7.1",
      [
        { op: "add", path: "/fields/System.Title", value: "Original (copy)" },
        { op: "add", path: "/fields/System.AssignedTo", value: "ada@example.com" }
      ],
      {
        "content-type": "application/json-patch+json",
        accept: "application/json"
      }
    );
  });

  it("reports duplicate as unsupported when POST transport is unavailable", async () => {
    const get = vi.fn(async () => ({ status: 200, json: {}, headers: {} }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    const result = await adapter.submit({
      kind: "WORK_ITEM_DUPLICATE",
      sourceWorkItemId: 42
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_DUPLICATE",
      operationCount: 1,
      reasonCode: "WRITE_UNSUPPORTED"
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("includes Azure duplicate creation error details", async () => {
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        fields: {
          "System.Title": "Original",
          "System.WorkItemType": "Task"
        }
      }
    }));
    const post = vi.fn(async () => ({
      status: 400,
      json: {
        message: "TF401320: Rule Error for field Custom.Required. Required fields must have a value."
      }
    }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    await expect(
      adapter.submit({
        kind: "WORK_ITEM_DUPLICATE",
        sourceWorkItemId: 42
      })
    ).rejects.toThrow(
      "WORK_ITEM_DUPLICATE_FAILED: TF401320: Rule Error for field Custom.Required. Required fields must have a value."
    );
  });

  it("includes Azure duplicate source fetch error details", async () => {
    const get = vi.fn(async () => ({
      status: 400,
      json: {
        message: "The expand parameter can not be used with the fields parameter."
      }
    }));
    const post = vi.fn(async () => ({ status: 200, json: { id: 1234 } }));
    const patch = vi.fn(async () => ({ status: 200, json: {} }));
    const adapter = new WriteCommandAzureAdapter(
      { get, post, patch },
      createContextStore({ organization: "contoso", project: "delivery" }) as never
    );

    await expect(
      adapter.submit({
        kind: "WORK_ITEM_DUPLICATE",
        sourceWorkItemId: 42
      })
    ).rejects.toThrow(
      "WORK_ITEM_DUPLICATE_SOURCE_FETCH_FAILED: The expand parameter can not be used with the fields parameter."
    );
    expect(post).not.toHaveBeenCalled();
  });
});
