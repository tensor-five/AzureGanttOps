import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";

import { AdoContextStore } from "../config/ado-context.store.js";
import { FileContextSettingsAdapter } from "../../adapters/persistence/settings/file-context-settings.adapter.js";
import type { HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";
import { createPhase1QueryFlow } from "../composition/phase1-query-flow.js";
import { QueryIntakeController } from "../../features/query-switching/query-intake.controller.js";

const ROOT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Azure DevOps Query-Driven Gantt</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/dist/src/app/bootstrap/local-ui-entry.js"></script>
  </body>
</html>
`;

export type HttpServer = {
  close: () => Promise<void>;
};

export function createHttpServer(params: {
  httpClient: HttpClient;
  port?: number;
  contextFilePath?: string;
  distRootPath?: string;
}): HttpServer {
  const contextFilePath =
    params.contextFilePath ?? path.join(os.homedir(), ".azure-ganttops", "ado-context.json");

  const queryFlow = createPhase1QueryFlow({
    httpClient: params.httpClient,
    contextFilePath
  });

  const settingsAdapter = new FileContextSettingsAdapter(contextFilePath);
  const contextStore = new AdoContextStore(settingsAdapter);
  const controller = new QueryIntakeController(contextStore, queryFlow.runQueryIntake);
  const distRootPath = path.resolve(params.distRootPath ?? path.join(process.cwd(), "dist"));

  const server = createServer(async (req, res) => {
    await route(req, res, controller, distRootPath);
  });

  server.listen(params.port ?? 8080, "127.0.0.1");

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  controller: QueryIntakeController,
  distRootPath: string
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://127.0.0.1");

  if (method === "POST" && url.pathname === "/phase2/query-intake") {
    const body = await readBody(req);
    const payload = parsePayload(body);

    if (!payload || typeof payload.queryInput !== "string") {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide queryInput as a string."
      });
      return;
    }

    const result = await controller.submit({
      queryInput: payload.queryInput,
      mappingProfileId: typeof payload.mappingProfileId === "string" ? payload.mappingProfileId : undefined,
      mappingProfileUpsert: parseMappingProfileUpsert(payload.mappingProfileUpsert)
    });
    writeJson(res, 200, result);
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    writeJson(res, 200, { status: "ok" });
    return;
  }

  if (method === "GET" && url.pathname === "/") {
    writeHtml(res, 200, ROOT_HTML);
    return;
  }

  if (method === "GET" && url.pathname.startsWith("/dist/")) {
    await serveDistAsset(url.pathname, distRootPath, res);
    return;
  }

  writeJson(res, 404, {
    code: "NOT_FOUND",
    message: "Route not found."
  });
}

function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseMappingProfileUpsert(input: unknown):
  | {
      id: string;
      name: string;
      fields: {
        id: string;
        title: string;
        start: string;
        endOrTarget: string;
      };
    }
  | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const candidate = input as {
    id?: unknown;
    name?: unknown;
    fields?: {
      id?: unknown;
      title?: unknown;
      start?: unknown;
      endOrTarget?: unknown;
    };
  };

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !candidate.fields ||
    typeof candidate.fields.id !== "string" ||
    typeof candidate.fields.title !== "string" ||
    typeof candidate.fields.start !== "string" ||
    typeof candidate.fields.endOrTarget !== "string"
  ) {
    return undefined;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    fields: {
      id: candidate.fields.id,
      title: candidate.fields.title,
      start: candidate.fields.start,
      endOrTarget: candidate.fields.endOrTarget
    }
  };
}

async function serveDistAsset(pathname: string, distRootPath: string, res: ServerResponse): Promise<void> {
  const assetPath = resolveDistAssetPath(pathname, distRootPath);

  if (!assetPath) {
    writeJson(res, 404, {
      code: "NOT_FOUND",
      message: "Route not found."
    });
    return;
  }

  try {
    const fileStat = await stat(assetPath);

    if (!fileStat.isFile()) {
      writeJson(res, 404, {
        code: "NOT_FOUND",
        message: "Route not found."
      });
      return;
    }

    const content = await readFile(assetPath);
    res.statusCode = 200;
    res.setHeader("content-type", contentTypeFor(assetPath));
    res.end(content);
  } catch {
    writeJson(res, 404, {
      code: "NOT_FOUND",
      message: "Route not found."
    });
  }
}

function resolveDistAssetPath(pathname: string, distRootPath: string): string | null {
  const encodedRelativePath = pathname.slice("/dist/".length);

  let decodedRelativePath = "";
  try {
    decodedRelativePath = decodeURIComponent(encodedRelativePath);
  } catch {
    return null;
  }

  const normalizedRelativePath = path.normalize(decodedRelativePath);
  const absolutePath = path.resolve(distRootPath, normalizedRelativePath);

  if (absolutePath === distRootPath || !absolutePath.startsWith(`${distRootPath}${path.sep}`)) {
    return null;
  }

  return absolutePath;
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  if (filePath.endsWith(".map")) {
    return "application/json; charset=utf-8";
  }

  return "application/octet-stream";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

function writeHtml(res: ServerResponse, statusCode: number, payload: string): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(payload);
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload)}\n`);
}
