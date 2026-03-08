import { afterEach, describe, expect, it } from "vitest";

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
      expect(text).toContain('/dist/src/app/bootstrap/local-ui-entry.js');
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
});

function startServer(params: { distRootPath: string; contextFilePath: string }): StartedServer {
  const port = 18080 + Math.floor(Math.random() * 1000);
  const server = createHttpServer({
    port,
    distRootPath: params.distRootPath,
    contextFilePath: params.contextFilePath,
    httpClient: {
      get: async () => ({
        status: 200,
        json: {
          value: []
        },
        headers: {}
      })
    }
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
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "azure-ganttops-http-server-"));
  tempDirs.push(root);

  const distRootPath = path.join(root, "dist");
  await mkdir(path.join(distRootPath, "src", "app", "bootstrap"), { recursive: true });
  await writeFile(path.join(distRootPath, "src", "app", "bootstrap", "local-ui-entry.js"), "export {}\n", "utf8");

  const contextFilePath = path.join(root, "ado-context.json");
  await writeFile(
    contextFilePath,
    JSON.stringify({
      organization: "contoso",
      project: "delivery"
    }),
    "utf8"
  );

  return {
    root,
    distRootPath,
    contextFilePath
  };
}
