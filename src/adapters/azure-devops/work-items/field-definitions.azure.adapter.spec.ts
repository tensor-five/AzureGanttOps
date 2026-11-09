import { describe, expect, it } from "vitest";

import { AzureFieldDefinitionsAdapter } from "./field-definitions.azure.adapter.js";

describe("AzureFieldDefinitionsAdapter", () => {
  const context = async () => ({ organization: "contoso", project: "delivery" });

  it("merges project field metadata with per-type fields and allowed values", async () => {
    const urls: string[] = [];
    const adapter = new AzureFieldDefinitionsAdapter(
      {
        get: async (url: string) => {
          urls.push(url);
          if (url.includes("/workitemtypes/User%20Story/fields")) {
            return { status: 200, json: { value: [{ referenceName: "A.Points", name: "Points" }, { referenceName: "A.Area", allowedValues: [] }] } };
          }
          if (url.includes("/workitemtypes/Bug/fields")) {
            return { status: 200, json: { value: [{ referenceName: "A.Area", allowedValues: ["X", 4] }, { name: "no ref" }] } };
          }
          return {
            status: 200,
            json: {
              value: [
                { referenceName: "A.Points", name: "Story Points", type: "double", readOnly: false },
                { referenceName: "A.Area", name: "Area", type: "string", readOnly: true, isIdentity: false }
              ]
            }
          };
        }
      },
      context
    );

    const fields = await adapter.listFieldDefinitions(["User Story", "Bug", "Bug", " "]);

    expect(fields).toEqual([
      { referenceName: "A.Points", name: "Story Points", type: "double", readOnly: false, isIdentity: false, allowedValues: [], workItemTypes: ["User Story"] },
      { referenceName: "A.Area", name: "Area", type: "string", readOnly: true, isIdentity: false, allowedValues: ["X"], workItemTypes: ["User Story", "Bug"] }
    ]);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe("https://dev.azure.com/contoso/delivery/_apis/wit/fields?api-version=7.1");
  });

  it("fails when Azure DevOps rejects a request or the context is missing", async () => {
    const failing = new AzureFieldDefinitionsAdapter({ get: async () => ({ status: 403, json: {} }) }, context);
    await expect(failing.listFieldDefinitions(["Bug"])).rejects.toThrow("FIELD_DEFINITIONS_FETCH_FAILED:403");

    const noContext = new AzureFieldDefinitionsAdapter({ get: async () => ({ status: 200, json: {} }) }, async () => null);
    await expect(noContext.listFieldDefinitions(["Bug"])).rejects.toThrow("ADO_CONTEXT_MISSING");
  });

  it("caches project field types per context and refreshes them after the TTL", async () => {
    let calls = 0;
    let now = 0;
    const adapter = new AzureFieldDefinitionsAdapter(
      {
        get: async () => {
          calls += 1;
          return { status: 200, json: { value: [{ referenceName: "A.Html", type: "html" }] } };
        }
      },
      context,
      () => now
    );

    expect((await adapter.getFieldTypes()).get("A.Html")).toBe("html");
    await adapter.getFieldTypes();
    expect(calls).toBe(1);

    now = 11 * 60 * 1000;
    await adapter.getFieldTypes();
    expect(calls).toBe(2);
  });

  it("does not cache failed project field requests", async () => {
    let calls = 0;
    const adapter = new AzureFieldDefinitionsAdapter(
      {
        get: async () => {
          calls += 1;
          return calls === 1 ? { status: 500, json: {} } : { status: 200, json: { value: [] } };
        }
      },
      context
    );

    await expect(adapter.getFieldTypes()).rejects.toThrow("FIELD_DEFINITIONS_FETCH_FAILED:500");
    await expect(adapter.getFieldTypes()).resolves.toEqual(new Map());
  });
});
