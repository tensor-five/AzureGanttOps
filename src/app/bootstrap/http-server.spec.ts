import { afterEach, describe, expect, it } from "vitest";

import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createHttpServer } from "./http-server.js";

type StartedServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

describe("createHttpServer", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
      })
    );
    tempDirs.length = 0;
  });

  it("returns HTML shell for GET /", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(text).toContain('<div id="app"></div>');
      expect(text).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
      expect(text).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />');
      expect(text).toContain('/dist/src/app/bootstrap/local-ui-entry.browser.css');
      expect(text).toContain('/dist/src/app/bootstrap/local-ui-entry.browser.js');
    } finally {
      await server.close();
    }
  });

  it("serves favicon for GET /favicon.svg", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/favicon.svg`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/svg+xml");
      expect(text).toContain("<svg");
    } finally {
      await server.close();
    }
  });

  it("serves favicon for GET /favicon.ico", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/favicon.ico`);
      const body = await response.arrayBuffer();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/x-icon");
      expect(body.byteLength).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it("keeps GET /health unchanged", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body).toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("keeps POST /phase2/query-intake invalid input behavior unchanged", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: 123 })
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body).toEqual({
        code: "INVALID_INPUT",
        message: "Provide queryInput as a string."
      });
    } finally {
      await server.close();
    }
  });

  it("returns JSON NOT_FOUND for unknown routes", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/unknown`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body).toEqual({
        code: "NOT_FOUND",
        message: "Route not found."
      });
    } finally {
      await server.close();
    }
  });

  it("returns ado communication logs with sequence and cursor", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async (url) => ({
          status: 200,
          json: {
            value: [],
            echo: `${url}&token=plain_token_value`
          },
          headers: {}
        })
      }
    });

    const originalPath = process.env.PATH;

    try {
      process.env.PATH = `${path.dirname(fixture.azCliShimPath)}:${originalPath ?? ""}`;

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111111" })
      });

      const response = await fetch(`${server.baseUrl}/phase2/ado-comm-logs`);
      const body = (await response.json()) as {
        entries: Array<{
          seq: number;
          direction: "request" | "response";
          url: string;
          preview: string;
        }>;
        nextSeq: number;
      };

      expect(response.status).toBe(200);
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body.entries.length).toBeGreaterThanOrEqual(2);
      expect(body.entries[0]?.seq).toBe(1);
      expect(body.entries[1]?.seq).toBe(2);
      expect(body.entries[0]?.direction).toBe("request");
      expect(body.entries[1]?.direction).toBe("response");
      expect(body.nextSeq).toBeGreaterThanOrEqual(2);
      expect(body.entries.every((entry) => !entry.url.includes("plain_token_value"))).toBe(true);
      expect(body.entries[1]?.preview).not.toContain("plain_token_value");
      expect(body.entries[1]?.preview).toContain("[REDACTED]");
    } finally {
      process.env.PATH = originalPath;
      await server.close();
    }
  });

  it("redacts bearer/jwt and token-like key values from ado communication previews", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async () => ({
          status: 200,
          json: {
            authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
            access_token: "tok_very_secret_value_123456",
            nested: {
              jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.signaturepart"
            }
          },
          headers: {}
        })
      }
    });

    const originalPath = process.env.PATH;

    try {
      process.env.PATH = `${path.dirname(fixture.azCliShimPath)}:${originalPath ?? ""}`;

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111114" })
      });

      const response = await fetch(`${server.baseUrl}/phase2/ado-comm-logs`);
      const body = (await response.json()) as {
        entries: Array<{
          direction: "request" | "response";
          preview: string;
        }>;
      };

      const responseEntry = body.entries.find((entry) => entry.direction === "response");
      expect(responseEntry).toBeDefined();
      expect(responseEntry?.preview).toContain("[REDACTED]");
      expect(responseEntry?.preview).not.toContain("tok_very_secret_value_123456");
      expect(responseEntry?.preview).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
      expect(responseEntry?.preview).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    } finally {
      process.env.PATH = originalPath;
      await server.close();
    }
  });

  it("returns only newer ado communication logs after cursor", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    const originalPath = process.env.PATH;

    try {
      process.env.PATH = `${path.dirname(fixture.azCliShimPath)}:${originalPath ?? ""}`;

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111112" })
      });

      const first = (await (await fetch(`${server.baseUrl}/phase2/ado-comm-logs`)).json()) as {
        entries: Array<{ seq: number }>;
        nextSeq: number;
      };

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111113" })
      });

      const second = (await (
        await fetch(`${server.baseUrl}/phase2/ado-comm-logs?afterSeq=${first.nextSeq}`)
      ).json()) as {
        entries: Array<{ seq: number }>;
        nextSeq: number;
      };

      expect(second.entries.length).toBeGreaterThanOrEqual(2);
      expect(second.entries.every((entry) => entry.seq > first.nextSeq)).toBe(true);
      expect(second.nextSeq).toBeGreaterThan(first.nextSeq);
    } finally {
      process.env.PATH = originalPath;
      await server.close();
    }
  });

  it("enforces ado communication log limit cap", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    const originalPath = process.env.PATH;

    try {
      process.env.PATH = `${path.dirname(fixture.azCliShimPath)}:${originalPath ?? ""}`;

      for (let index = 0; index < 120; index += 1) {
        await fetch(`${server.baseUrl}/phase2/query-intake`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ queryInput: `11111111-1111-4111-8111-${(index + 1000).toString().padStart(12, "0")}` })
        });
      }

      const capped = (await (
        await fetch(`${server.baseUrl}/phase2/ado-comm-logs?afterSeq=0&limit=9999`)
      ).json()) as {
        entries: Array<{ seq: number }>;
      };

      expect(capped.entries.length).toBeLessThanOrEqual(200);
    } finally {
      process.env.PATH = originalPath;
      await server.close();
    }
  });

  it("starts Azure CLI login via POST /phase2/az-login", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      azLoginRunner: async () => ({
        message: "Azure CLI login completed. Retry query intake."
      })
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/az-login`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        }
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "OK",
        message: "Azure CLI login completed. Retry query intake."
      });
    } finally {
      await server.close();
    }
  });

  it("rejects manual Azure CLI path via POST /phase2/az-cli-path", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/az-cli-path`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          path: "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        code: "FORBIDDEN",
        message: "Manual Azure CLI path override is disabled for security reasons."
      });
    } finally {
      await server.close();
      delete process.env.ADO_AZ_CLI_PATH;
    }
  });

  it("auto-detects Azure CLI path via POST /phase2/az-cli-path with empty input", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      azCliPathResolver: async () => "C:\\Tools\\AzureCLI\\az.cmd"
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/az-cli-path`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          path: ""
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "OK",
        path: "C:\\Tools\\AzureCLI\\az.cmd"
      });
    } finally {
      await server.close();
      delete process.env.ADO_AZ_CLI_PATH;
    }
  });

  it("rejects az-login without csrf token", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/az-login`, {
        method: "POST",
        headers: {
          accept: "application/json"
        }
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        code: "CSRF_INVALID",
        message: "Missing or invalid CSRF protection."
      });
    } finally {
      await server.close();
    }
  });

  it("embeds a hex csrf token in root HTML", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const first = await fetchCsrfToken(server.baseUrl);
      const second = await fetchCsrfToken(server.baseUrl);

      expect(first).toMatch(/^[a-f0-9]{64}$/);
      expect(second).toMatch(/^[a-f0-9]{64}$/);
      expect(first).toBe(second);
    } finally {
      await server.close();
    }
  });

  it("persists and reloads user preferences via /phase2/user-preferences", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      userPreferencesFilePath: fixture.userPreferencesFilePath
    });

    try {
      const saveResponse = await fetch(`${server.baseUrl}/phase2/user-preferences`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          preferences: {
            themeMode: "dark",
            timelineColorCoding: "status",
            timelineDetailsWidthPx: 444,
            timelineSidebarWidthPx: 280,
            timelineLabelFields: [],
            timelineSidebarFields: ["title", "Custom.Team"],
            savedQueries: [
              {
                id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
                name: "delivery/default",
                queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95",
                organization: "contoso",
                project: "delivery"
              }
            ],
            selectedHeaderQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
            filters: {
              assignee: "me"
            }
          }
        })
      });
      const saveBody = await saveResponse.json();

      expect(saveResponse.status).toBe(200);
      expect(saveBody.preferences.themeMode).toBe("dark");
      expect(saveBody.preferences.timelineColorCoding).toBe("status");
      expect(saveBody.preferences.timelineDetailsWidthPx).toBe(444);
      expect(saveBody.preferences.timelineSidebarWidthPx).toBe(280);
      expect(saveBody.preferences.timelineLabelFields).toEqual([]);
      expect(saveBody.preferences.timelineSidebarFields).toEqual(["title", "Custom.Team"]);
      expect(saveBody.preferences.savedQueries).toEqual([
        {
          id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          name: "delivery/default",
          queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95",
          organization: "contoso",
          project: "delivery"
        }
      ]);
      expect(saveBody.preferences.selectedHeaderQueryId).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
      expect(saveBody.preferences.filters).toEqual({
        assignee: "me"
      });

      const loadResponse = await fetch(`${server.baseUrl}/phase2/user-preferences`);
      const loadBody = await loadResponse.json();

      expect(loadResponse.status).toBe(200);
      expect(loadBody.preferences.themeMode).toBe("dark");
      expect(loadBody.preferences.timelineColorCoding).toBe("status");
      expect(loadBody.preferences.timelineDetailsWidthPx).toBe(444);
      expect(loadBody.preferences.timelineSidebarWidthPx).toBe(280);
      expect(loadBody.preferences.timelineLabelFields).toEqual([]);
      expect(loadBody.preferences.timelineSidebarFields).toEqual(["title", "Custom.Team"]);
      expect(loadBody.preferences.savedQueries).toEqual([
        {
          id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          name: "delivery/default",
          queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95",
          organization: "contoso",
          project: "delivery"
        }
      ]);
      expect(loadBody.preferences.selectedHeaderQueryId).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
      expect(loadBody.preferences.filters).toEqual({
        assignee: "me"
      });
    } finally {
      await server.close();
    }
  });

  it("loads query details via /phase2/query-details", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const queryId = "342f0f44-4069-46b1-a940-3d0468979ceb";
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async (url) => {
          if (url.includes(`/_apis/wit/queries/${queryId}`)) {
            return {
              status: 200,
              json: {
                id: queryId,
                name: "Active Bugs",
                path: "My Queries/Website/Active Bugs"
              },
              headers: {}
            };
          }

          return {
            status: 200,
            json: { value: [] },
            headers: {}
          };
        }
      }
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/query-details?queryId=${encodeURIComponent(queryId)}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        id: queryId,
        name: "Active Bugs",
        path: "My Queries/Website/Active Bugs"
      });
    } finally {
      await server.close();
    }
  });
});

function startServer(params: {
  distRootPath: string;
  contextFilePath: string;
  userPreferencesFilePath?: string;
  httpClient?: {
    get: (url: string) => Promise<{
      status: number;
      json: unknown;
      headers: Record<string, string | undefined>;
    }>;
  };
  azLoginRunner?: () => Promise<{ message: string }>;
  azCliPathResolver?: () => Promise<string>;
}): StartedServer {
  const port = 18080 + Math.floor(Math.random() * 1000);
  const server = createHttpServer({
    port,
    distRootPath: params.distRootPath,
    contextFilePath: params.contextFilePath,
    userPreferencesFilePath: params.userPreferencesFilePath,
    httpClient:
      params.httpClient ??
      {
        get: async () => ({
          status: 200,
          json: {
            value: []
          },
          headers: {}
        })
      },
    azLoginRunner: params.azLoginRunner,
    azCliPathResolver: params.azCliPathResolver
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => server.close()
  };
}

async function fetchCsrfToken(baseUrl: string): Promise<string> {
  const response = await fetch(baseUrl, {
    method: "GET",
    headers: {
      accept: "text/html"
    }
  });
  const html = await response.text();
  const match = html.match(/<meta name="ado-csrf-token" content="([^"]+)"/);
  if (!match) {
    throw new Error("CSRF token meta tag missing in root HTML.");
  }

  return match[1];
}

async function createFixtureDir(tempDirs: string[]): Promise<{
  root: string;
  distRootPath: string;
  contextFilePath: string;
  userPreferencesFilePath: string;
  azCliShimPath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "azure-ganttops-http-server-"));
  tempDirs.push(root);

  const distRootPath = path.join(root, "dist");
  await mkdir(path.join(distRootPath, "src", "app", "bootstrap"), { recursive: true });
  await writeFile(path.join(distRootPath, "src", "app", "bootstrap", "local-ui-entry.browser.js"), "export {}\n", "utf8");

  const contextFilePath = path.join(root, "ado-context.json");
  const userPreferencesFilePath = path.join(root, "user-preferences.json");
  await writeFile(
    contextFilePath,
    JSON.stringify({
      organization: "contoso",
      project: "delivery"
    }),
    "utf8"
  );

  const azCliShimPath = path.join(root, "az");
  await writeFile(
    azCliShimPath,
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"--version\" ]; then",
      "  echo 'azure-cli 2.0'",
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"extension\" ] && [ \"$2\" = \"show\" ]; then",
      "  echo '{}'",
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"account\" ] && [ \"$2\" = \"show\" ]; then",
      "  echo '{}'",
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"devops\" ] && [ \"$2\" = \"configure\" ] && [ \"$3\" = \"--list\" ]; then",
      "  echo 'organization = contoso'",
      "  echo 'project = delivery'",
      "  exit 0",
      "fi",
      "exit 1"
    ].join("\n"),
    "utf8"
  );
  await chmod(azCliShimPath, 0o755);

  return {
    root,
    distRootPath,
    contextFilePath,
    userPreferencesFilePath,
    azCliShimPath
  };
}
