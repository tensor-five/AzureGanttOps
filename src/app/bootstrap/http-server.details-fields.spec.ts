/**
 * Frozen backend tests for the approved contract
 * docs/contracts/details-panel-field-configuration.v2.html.
 * Requirement IDs are named in each test title; see
 * docs/contracts/details-panel-field-configuration.v2.traceability.md.
 */
import { afterEach, describe, expect, it } from "vitest";

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createHttpServer } from "./http-server.js";

type FakeResponse = { status: number; json: unknown; headers: Record<string, string | undefined> };
type FakeHttpClient = {
  get: (url: string) => Promise<FakeResponse>;
  patch?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<FakeResponse>;
};

const STORY_POINTS = "Microsoft.VSTS.Scheduling.StoryPoints";
const PRIORITY = "Microsoft.VSTS.Common.Priority";
const VALUE_AREA = "Microsoft.VSTS.Common.ValueArea";
const CREATED_DATE = "System.CreatedDate";
const ASSIGNED_TO = "System.AssignedTo";
const REMAINING_WORK = "Microsoft.VSTS.Scheduling.RemainingWork";

const PROJECT_FIELDS = [
  { referenceName: "System.Title", name: "Title", type: "string", readOnly: false, isIdentity: false, isPicklist: false },
  { referenceName: ASSIGNED_TO, name: "Assigned To", type: "string", readOnly: false, isIdentity: true, isPicklist: false },
  { referenceName: STORY_POINTS, name: "Story Points", type: "double", readOnly: false, isIdentity: false, isPicklist: false },
  { referenceName: PRIORITY, name: "Priority", type: "integer", readOnly: false, isIdentity: false, isPicklist: false },
  { referenceName: VALUE_AREA, name: "Value Area", type: "string", readOnly: false, isIdentity: false, isPicklist: true },
  { referenceName: CREATED_DATE, name: "Created Date", type: "dateTime", readOnly: true, isIdentity: false, isPicklist: false },
  { referenceName: REMAINING_WORK, name: "Remaining Work", type: "double", readOnly: false, isIdentity: false, isPicklist: false },
  { referenceName: "Custom.UnusedElsewhere", name: "Unused Elsewhere", type: "string", readOnly: false, isIdentity: false, isPicklist: false }
];

const TYPE_FIELDS: Record<string, Array<{ referenceName: string; name: string; allowedValues: string[] }>> = {
  "User Story": [
    { referenceName: "System.Title", name: "Title", allowedValues: [] },
    { referenceName: ASSIGNED_TO, name: "Assigned To", allowedValues: [] },
    { referenceName: STORY_POINTS, name: "Story Points", allowedValues: [] },
    { referenceName: PRIORITY, name: "Priority", allowedValues: ["1", "2", "3", "4"] },
    { referenceName: VALUE_AREA, name: "Value Area", allowedValues: ["Business", "Architectural"] },
    { referenceName: CREATED_DATE, name: "Created Date", allowedValues: [] }
  ],
  Bug: [
    { referenceName: "System.Title", name: "Title", allowedValues: [] },
    { referenceName: PRIORITY, name: "Priority", allowedValues: ["1", "2", "3", "4"] },
    { referenceName: REMAINING_WORK, name: "Remaining Work", allowedValues: [] }
  ],
  Epic: [{ referenceName: "Custom.UnusedElsewhere", name: "Unused Elsewhere", allowedValues: [] }]
};

function createAzureFieldClient(options: { failFields?: boolean } = {}): FakeHttpClient & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    get: async (url: string) => {
      urls.push(url);
      const typeMatch = /\/_apis\/wit\/workitemtypes\/([^/?]+)\/fields/i.exec(url);
      if (typeMatch) {
        const typeName = decodeURIComponent(typeMatch[1]);
        const fields = TYPE_FIELDS[typeName];
        return fields
          ? { status: 200, json: { count: fields.length, value: fields }, headers: {} }
          : { status: 404, json: { message: "Work item type not found" }, headers: {} };
      }

      if (/\/_apis\/wit\/fields(\?|$)/i.test(url)) {
        if (options.failFields) {
          return { status: 500, json: { message: "VS402375: internal failure, token=secret-value" }, headers: {} };
        }
        return { status: 200, json: { count: PROJECT_FIELDS.length, value: PROJECT_FIELDS }, headers: {} };
      }

      return { status: 200, json: { value: [] }, headers: {} };
    }
  };
}

describe("details panel field configuration backend", () => {
  const tempDirs: string[] = [];
  let previousWriteEnabled: string | undefined;

  afterEach(async () => {
    if (previousWriteEnabled === undefined) {
      delete process.env.ADO_WRITE_ENABLED;
    } else {
      process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
    }
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("DPF-04 DPF-17 returns live field definitions for the requested work item types with type, read-only flag and allowed values", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const httpClient = createAzureFieldClient();
    const server = startServer(fixture, httpClient);

    try {
      const response = await fetch(
        `${server.baseUrl}/phase2/work-item-field-definitions?workItemTypes=${encodeURIComponent("User Story")}&workItemTypes=Bug`,
        { headers: { accept: "application/json" } }
      );
      const body = (await response.json()) as { fields: Array<Record<string, unknown>> };

      expect(response.status).toBe(200);
      const byRef = new Map(body.fields.map((field) => [field.referenceName as string, field]));

      expect(byRef.get(STORY_POINTS)).toMatchObject({
        referenceName: STORY_POINTS,
        name: "Story Points",
        type: "double",
        readOnly: false,
        isIdentity: false,
        allowedValues: [],
        workItemTypes: ["User Story"]
      });
      expect(byRef.get(PRIORITY)).toMatchObject({ type: "integer", readOnly: false });
      expect([...(byRef.get(PRIORITY)?.workItemTypes as string[])].sort()).toEqual(["Bug", "User Story"]);
      expect(byRef.get(VALUE_AREA)).toMatchObject({ allowedValues: ["Business", "Architectural"] });
      expect(byRef.get(CREATED_DATE)).toMatchObject({ type: "dateTime", readOnly: true });
      expect(byRef.get(ASSIGNED_TO)).toMatchObject({ isIdentity: true });
      expect(byRef.get(REMAINING_WORK)).toMatchObject({ workItemTypes: ["Bug"] });
      expect(byRef.has("Custom.UnusedElsewhere")).toBe(false);
      expect(body.fields.filter((field) => field.referenceName === "System.Title")).toHaveLength(1);

      expect(httpClient.urls.some((url) => /\/workitemtypes\/User%20Story\/fields/i.test(url))).toBe(true);
      expect(httpClient.urls.some((url) => /\/workitemtypes\/Bug\/fields/i.test(url))).toBe(true);
      expect(httpClient.urls.some((url) => /\/workitemtypes\/Epic\/fields/i.test(url))).toBe(false);
      expect(httpClient.urls.every((url) => url.startsWith("https://dev.azure.com/contoso/delivery/_apis/wit/") || !url.includes("/_apis/wit/"))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("DPF-05 reports a failure without leaking Azure details when field definitions cannot be loaded", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer(fixture, createAzureFieldClient({ failFields: true }));

    try {
      const response = await fetch(`${server.baseUrl}/phase2/work-item-field-definitions?workItemTypes=Bug`, {
        headers: { accept: "application/json" }
      });
      const text = await response.text();

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(JSON.parse(text)).toHaveProperty("code", "FIELD_DEFINITIONS_FAILED");
      // Project security rule (CLAUDE.md: errors without sensitive data), not a contract clause.
      expect(text).not.toContain("secret-value");
    } finally {
      await server.close();
    }
  });

  it("DPF-19 saves all changed fields in one Azure DevOps patch, keeps numbers numeric and clears empty values", async () => {
    previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const fixture = await createFixtureDir(tempDirs);
    const calls: Array<{ url: string; body: unknown }> = [];
    const server = startServer(fixture, {
      get: async () => ({ status: 200, json: { value: [] }, headers: {} }),
      patch: async (url, body) => {
        calls.push({ url, body });
        return { status: 200, json: { id: 42, rev: 7, fields: {} }, headers: {} };
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-details-update`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          targetWorkItemId: 42,
          fields: {
            "System.Title": "Renamed item",
            [STORY_POINTS]: 3.5,
            [VALUE_AREA]: "Architectural",
            [REMAINING_WORK]: null
          }
        })
      });
      const body = (await response.json()) as { commandKind?: string };

      expect(response.status).toBe(200);
      expect(body.commandKind).toBe("WORK_ITEM_PATCH");
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://dev.azure.com/contoso/delivery/_apis/wit/workitems/42?api-version=7.1");
      const operations = calls[0].body as Array<{ op: string; path: string; value?: unknown }>;
      expect(operations).toEqual(
        expect.arrayContaining([
          { op: "add", path: "/fields/System.Title", value: "Renamed item" },
          { op: "add", path: `/fields/${STORY_POINTS}`, value: 3.5 },
          { op: "add", path: `/fields/${VALUE_AREA}`, value: "Architectural" },
          { op: "remove", path: `/fields/${REMAINING_WORK}` }
        ])
      );
      expect(operations).toHaveLength(4);
    } finally {
      await server.close();
    }
  });

  it("DPF-19 returns the Azure DevOps error message when a field update is rejected", async () => {
    previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer(fixture, {
      get: async () => ({ status: 200, json: { value: [] }, headers: {} }),
      patch: async () => ({
        status: 400,
        json: {
          message:
            "TF51535: Cannot find field Microsoft.VSTS.Scheduling.StoryPoints. Authorization: Bearer abc.def.ghi token=secret-value",
          typeKey: "WorkItemFieldInvalidException"
        },
        headers: {}
      })
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-details-update`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({ targetWorkItemId: 802, fields: { [STORY_POINTS]: 3 } })
      });
      const body = (await response.json()) as { message?: string };

      expect(response.ok).toBe(false);
      expect(body.message).toContain("TF51535: Cannot find field Microsoft.VSTS.Scheduling.StoryPoints.");
      expect(body.message).not.toContain("abc.def.ghi");
      expect(body.message).not.toContain("secret-value");
    } finally {
      await server.close();
    }
  });

  it("DPF-21 persists the ordered details field configuration in the local user preferences", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer(fixture, createAzureFieldClient());
    const configuration = [STORY_POINTS, "System.Title", PRIORITY];

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const saveResponse = await fetch(`${server.baseUrl}/phase2/user-preferences`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({ preferences: { detailsPanelFields: configuration } })
      });
      expect(saveResponse.status).toBe(200);

      const loadResponse = await fetch(`${server.baseUrl}/phase2/user-preferences`);
      const loadBody = (await loadResponse.json()) as { preferences: Record<string, unknown> };
      expect(loadResponse.status).toBe(200);
      expect(loadBody.preferences.detailsPanelFields).toEqual(configuration);
    } finally {
      await server.close();
    }
  });
});

function startServer(
  fixture: { distRootPath: string; contextFilePath: string; userPreferencesFilePath: string },
  httpClient: FakeHttpClient
): { baseUrl: string; close: () => Promise<void> } {
  const port = 19100 + Math.floor(Math.random() * 800);
  const server = createHttpServer({
    port,
    distRootPath: fixture.distRootPath,
    contextFilePath: fixture.contextFilePath,
    userPreferencesFilePath: fixture.userPreferencesFilePath,
    httpClient,
    adoHttpFailureLogWriter: () => undefined
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await server.close();
    }
  };
}

async function fetchCsrfToken(baseUrl: string): Promise<string> {
  const response = await fetch(baseUrl, { headers: { accept: "text/html" } });
  const html = await response.text();
  const match = html.match(/<meta name="ado-csrf-token" content="([^"]+)"/);
  if (!match) {
    throw new Error("CSRF token meta tag missing in root HTML.");
  }
  return match[1];
}

async function createFixtureDir(tempDirs: string[]): Promise<{
  distRootPath: string;
  contextFilePath: string;
  userPreferencesFilePath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "azure-ganttops-details-fields-"));
  tempDirs.push(root);

  const distRootPath = path.join(root, "dist");
  await mkdir(path.join(distRootPath, "src", "app", "bootstrap"), { recursive: true });
  await writeFile(path.join(distRootPath, "src", "app", "bootstrap", "local-ui-entry.browser.js"), "export {}\n", "utf8");

  const contextFilePath = path.join(root, "ado-context.json");
  await writeFile(contextFilePath, JSON.stringify({ organization: "contoso", project: "delivery" }), "utf8");

  return {
    distRootPath,
    contextFilePath,
    userPreferencesFilePath: path.join(root, "user-preferences.json")
  };
}
