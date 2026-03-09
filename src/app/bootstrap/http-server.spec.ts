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
      expect(text).toContain('/dist/src/app/bootstrap/local-ui-entry.browser.css');
      expect(text).toContain('/dist/src/app/bootstrap/local-ui-entry.browser.js');
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
      const response = await fetch(`${server.baseUrl}/phase2/az-login`, {
        method: "POST",
        headers: {
          accept: "application/json"
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

  it("stores manual Azure CLI path via POST /phase2/az-cli-path", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/az-cli-path`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          path: "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "OK",
        path: "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd"
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
      const response = await fetch(`${server.baseUrl}/phase2/az-cli-path`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
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
});

function startServer(params: {
  distRootPath: string;
  contextFilePath: string;
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

async function createFixtureDir(tempDirs: string[]): Promise<{
  root: string;
  distRootPath: string;
  contextFilePath: string;
  azCliShimPath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "azure-ganttops-http-server-"));
  tempDirs.push(root);

  const distRootPath = path.join(root, "dist");
  await mkdir(path.join(distRootPath, "src", "app", "bootstrap"), { recursive: true });
  await writeFile(path.join(distRootPath, "src", "app", "bootstrap", "local-ui-entry.browser.js"), "export {}\n", "utf8");

  const contextFilePath = path.join(root, "ado-context.json");
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
    azCliShimPath
  };
}
