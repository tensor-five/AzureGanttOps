import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { buildAzCommand, resolveAzCliExecutablePath } from "../../shared/utils/azure-cli-path.js";

import { AdoContextStore } from "../config/ado-context.store.js";
import { FileContextSettingsAdapter } from "../../adapters/persistence/settings/file-context-settings.adapter.js";
import type { HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";
import { createPhase1QueryFlow } from "../composition/phase1-query-flow.js";
import { QueryIntakeController } from "../../features/query-switching/query-intake.controller.js";
import type { SubmitWriteCommandUseCase } from "../../application/use-cases/submit-write-command.use-case.js";

const THEME_MODE_STORAGE_KEY = "azure-ganttops.theme-mode.v1";

const ROOT_HTML = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Azure DevOps Query-Driven Gantt</title>
    <script>
      (() => {
        const key = "${THEME_MODE_STORAGE_KEY}";
        let mode = "system";
        try {
          const persisted = window.localStorage.getItem(key);
          if (persisted === "light" || persisted === "dark" || persisted === "system") {
            mode = persisted;
          }
        } catch {}

        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const effectiveTheme = mode === "dark" ? "dark" : mode === "light" ? "light" : (prefersDark ? "dark" : "light");
        const root = document.documentElement;
        root.dataset.themeMode = mode;
        root.dataset.theme = effectiveTheme;
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <link rel="stylesheet" href="/dist/src/app/bootstrap/local-ui-entry.browser.css" />
    <script type="module" src="/dist/src/app/bootstrap/local-ui-entry.browser.js"></script>
  </body>
</html>
`;

export type HttpServer = {
  close: () => Promise<void>;
};

type AdoCommLogDirection = "request" | "response";
type AdoCommMethod = "GET" | "PATCH";

type AdoCommLogEntry = {
  seq: number;
  timestamp: string;
  direction: AdoCommLogDirection;
  method: AdoCommMethod;
  url: string;
  status: number | null;
  durationMs: number | null;
  preview: string;
};

type AdoCommLogStore = {
  append: (entry: Omit<AdoCommLogEntry, "seq">) => void;
  read: (afterSeq: number, limit: number) => { entries: AdoCommLogEntry[]; nextSeq: number };
};

const ADO_COMM_LOG_BUFFER_MAX = 1000;
const ADO_COMM_LOG_LIMIT_DEFAULT = 50;
const ADO_COMM_LOG_LIMIT_MAX = 200;
const ADO_COMM_LOG_PREVIEW_MAX = 500;
const SENSITIVE_QUERY_PARAM_PATTERN = /token|secret|password|pat|sig|key|code|auth/i;
const SENSITIVE_INLINE_PATTERN = /(token|secret|password|pat|authorization)[^\s]*/gi;
const ADO_COMM_DEFAULT_METHOD = "GET" as const;
const ADO_COMM_EMPTY_PREVIEW = "";
const ADO_COMM_NO_STATUS = null;
const ADO_COMM_NO_DURATION = null;
const ADO_COMM_ORIGIN = "http://127.0.0.1";
const ADO_COMM_ROUTE_PATH = "/phase2/ado-comm-logs";
const ADOPT_SCHEDULE_ROUTE_PATH = "/phase2/work-item-schedule-adopt";
const UPDATE_DETAILS_ROUTE_PATH = "/phase2/work-item-details-update";
const AZ_LOGIN_ROUTE_PATH = "/phase2/az-login";
const AZ_CLI_PATH_ROUTE_PATH = "/phase2/az-cli-path";
const ADO_COMM_URL_PATH_ORIGIN = "https://dev.azure.com";
const ADO_COMM_INVALID_LIMIT = 0;
const ADO_COMM_DEFAULT_AFTER_SEQ = 0;
const ADO_COMM_MIN_LIMIT = 1;
const ADO_COMM_ZERO_DURATION = 0;
const ADO_COMM_TIMESTAMP = () => new Date().toISOString();
const ADO_COMM_DURATION = (startedAt: number) => Math.max(ADO_COMM_ZERO_DURATION, Date.now() - startedAt);
const ADO_COMM_REDACTED = "[REDACTED]";
const ADO_COMM_UNKNOWN_PATH = "[invalid-url]";
const ADO_COMM_PREVIEW_FALLBACK = "{}";
const ADO_COMM_EMPTY_RESULT_SEQ = (afterSeq: number) => afterSeq;
const ADO_COMM_NEXT_SEQ_FROM_ENTRY = (entry: AdoCommLogEntry) => entry.seq;
const ADO_COMM_DEFAULT_JSON_PREVIEW = (value: unknown) => JSON.stringify(value ?? ADO_COMM_PREVIEW_FALLBACK);
const ADO_COMM_ROUTE_QUERY_AFTER_SEQ = "afterSeq";
const ADO_COMM_ROUTE_QUERY_LIMIT = "limit";
const ADO_COMM_LOG_VERBOSE_PREFIX = "[ado-runtime]";
const ADO_COMM_ROUTE_NOT_FOUND = {
  code: "NOT_FOUND",
  message: "Route not found."
} as const;
const execAsync = promisify(exec);

type AzLoginRunner = () => Promise<{
  message: string;
}>;
type AzCliPathResolver = () => Promise<string>;

function createAdoCommLogStore(maxEntries: number): AdoCommLogStore {
  const entries: AdoCommLogEntry[] = [];
  let seq = 0;

  return {
    append: (entry) => {
      seq += 1;
      entries.push({
        ...entry,
        seq
      });

      if (entries.length > maxEntries) {
        entries.splice(0, entries.length - maxEntries);
      }
    },
    read: (afterSeq, limit) => {
      const nextEntries = entries.filter((entry) => entry.seq > afterSeq).slice(0, limit);
      return {
        entries: nextEntries,
        nextSeq:
          nextEntries.length > 0
            ? ADO_COMM_NEXT_SEQ_FROM_ENTRY(nextEntries[nextEntries.length - 1])
            : ADO_COMM_EMPTY_RESULT_SEQ(afterSeq)
      };
    }
  };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < ADO_COMM_INVALID_LIMIT) {
    return fallback;
  }

  return parsed;
}

function sanitizeUrlForLog(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, ADO_COMM_URL_PATH_ORIGIN);
    for (const [key] of parsed.searchParams.entries()) {
      if (SENSITIVE_QUERY_PARAM_PATTERN.test(key)) {
        parsed.searchParams.set(key, ADO_COMM_REDACTED);
      }
    }

    const search = parsed.searchParams.toString();
    return `${parsed.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return ADO_COMM_UNKNOWN_PATH;
  }
}

function sanitizePreviewForLog(input: string): string {
  return sanitizeLogText(input)
    .replace(SENSITIVE_INLINE_PATTERN, ADO_COMM_REDACTED)
    .slice(0, ADO_COMM_LOG_PREVIEW_MAX);
}

function resolveAdoCommLogRequest(url: URL): { afterSeq: number; limit: number } {
  const afterSeq = parsePositiveInt(url.searchParams.get(ADO_COMM_ROUTE_QUERY_AFTER_SEQ), ADO_COMM_DEFAULT_AFTER_SEQ);
  const requestedLimit = parsePositiveInt(url.searchParams.get(ADO_COMM_ROUTE_QUERY_LIMIT), ADO_COMM_LOG_LIMIT_DEFAULT);
  const limit = Math.min(Math.max(requestedLimit, ADO_COMM_MIN_LIMIT), ADO_COMM_LOG_LIMIT_MAX);

  return {
    afterSeq,
    limit
  };
}

function createAdoCommLogPreview(payload: unknown): string {
  return sanitizePreviewForLog(ADO_COMM_DEFAULT_JSON_PREVIEW(payload));
}

function logVerboseRoute(verboseLogs: boolean, method: string, pathname: string): void {
  if (verboseLogs) {
    console.log(`${ADO_COMM_LOG_VERBOSE_PREFIX} route ${method} ${pathname}`);
  }
}

function logVerboseHttpRequest(verboseLogs: boolean, method: AdoCommMethod, url: string): void {
  if (verboseLogs) {
    console.log(`${ADO_COMM_LOG_VERBOSE_PREFIX} http ${method} ${url}`);
  }
}

function logVerboseHttpResponse(verboseLogs: boolean, response: { status: number; json: unknown }): void {
  if (verboseLogs) {
    const payloadPreview = sanitizeLogText(JSON.stringify(response.json)).slice(0, ADO_COMM_LOG_PREVIEW_MAX);
    console.log(`${ADO_COMM_LOG_VERBOSE_PREFIX} http response status=${response.status} payload=${payloadPreview}`);
  }
}

function logVerboseIntake(verboseLogs: boolean, result: {
  statusCode: string;
  preflightStatus: string;
  uiState: string;
  activeQueryId: string | null;
  errorCode: string | null;
}): void {
  if (verboseLogs) {
    console.log(
      `${ADO_COMM_LOG_VERBOSE_PREFIX} intake outcome status=${result.statusCode} preflight=${result.preflightStatus} uiState=${result.uiState} activeQuery=${result.activeQueryId ?? "none"} error=${result.errorCode ?? "none"}`
    );
  }
}

function appendAdoCommRequestLog(store: AdoCommLogStore, url: string, method: AdoCommMethod): void {
  store.append({
    timestamp: ADO_COMM_TIMESTAMP(),
    direction: "request",
    method,
    url: sanitizeUrlForLog(url),
    status: ADO_COMM_NO_STATUS,
    durationMs: ADO_COMM_NO_DURATION,
    preview: ADO_COMM_EMPTY_PREVIEW
  });
}

function appendAdoCommResponseLog(store: AdoCommLogStore, params: {
  url: string;
  method: AdoCommMethod;
  status: number;
  durationMs: number;
  json: unknown;
}): void {
  store.append({
    timestamp: ADO_COMM_TIMESTAMP(),
    direction: "response",
    method: params.method,
    url: sanitizeUrlForLog(params.url),
    status: params.status,
    durationMs: params.durationMs,
    preview: createAdoCommLogPreview(params.json)
  });
}

function sanitizeIncomingPath(url: string | undefined): URL {
  return new URL(url ?? "/", ADO_COMM_ORIGIN);
}

function routeNotFound(res: ServerResponse): void {
  writeJson(res, 404, ADO_COMM_ROUTE_NOT_FOUND);
}

function isAdoCommLogRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === ADO_COMM_ROUTE_PATH;
}

function isHealthRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/health";
}

function isRootRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/";
}

function isDistRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname.startsWith("/dist/");
}

function isQueryIntakeRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === "/phase2/query-intake";
}

function isAdoptScheduleRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === ADOPT_SCHEDULE_ROUTE_PATH;
}

function isUpdateDetailsRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === UPDATE_DETAILS_ROUTE_PATH;
}

function isAzLoginRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === AZ_LOGIN_ROUTE_PATH;
}

function isAzCliPathRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === AZ_CLI_PATH_ROUTE_PATH;
}

function writeAdoCommLogsResponse(res: ServerResponse, store: AdoCommLogStore, url: URL): void {
  const request = resolveAdoCommLogRequest(url);
  const snapshot = store.read(request.afterSeq, request.limit);
  writeJson(res, 200, snapshot);
}

export function createHttpServer(params: {
  httpClient: HttpClient & {
    patch?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<{
      status: number;
      json: unknown;
      headers?: Record<string, string | undefined>;
    }>;
  };
  port?: number;
  contextFilePath?: string;
  distRootPath?: string;
  azLoginRunner?: AzLoginRunner;
  azCliPathResolver?: AzCliPathResolver;
}): HttpServer {
  const verboseLogs = process.env.ADO_VERBOSE_LOGS === "1";
  if (verboseLogs) {
    console.log("[ado-runtime] verbose logging enabled");
  }

  const adoCommLogStore = createAdoCommLogStore(ADO_COMM_LOG_BUFFER_MAX);

  const instrumentedHttpClient: HttpClient & {
    patch?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<{
      status: number;
      json: unknown;
      headers?: Record<string, string | undefined>;
    }>;
  } = {
    get: async (url: string) => {
      const startedAt = Date.now();
      logVerboseHttpRequest(verboseLogs, "GET", url);
      appendAdoCommRequestLog(adoCommLogStore, url, "GET");

      const response = await params.httpClient.get(url);

      logVerboseHttpResponse(verboseLogs, response);
      appendAdoCommResponseLog(adoCommLogStore, {
        url,
        method: "GET",
        status: response.status,
        durationMs: ADO_COMM_DURATION(startedAt),
        json: response.json
      });

      return response;
    }
  };
  if (params.httpClient.patch) {
    instrumentedHttpClient.patch = async (url: string, body: unknown, headers?: Record<string, string>) => {
      const startedAt = Date.now();
      logVerboseHttpRequest(verboseLogs, "PATCH", url);
      appendAdoCommRequestLog(adoCommLogStore, url, "PATCH");

      const response = await params.httpClient.patch!(url, body, headers);
      logVerboseHttpResponse(verboseLogs, response);
      appendAdoCommResponseLog(adoCommLogStore, {
        url,
        method: "PATCH",
        status: response.status,
        durationMs: ADO_COMM_DURATION(startedAt),
        json: response.json
      });

      return response;
    };
  }

  const contextFilePath =
    params.contextFilePath ?? path.join(os.homedir(), ".azure-ganttops", "ado-context.json");

  const queryFlow = createPhase1QueryFlow({
    httpClient: instrumentedHttpClient,
    contextFilePath,
    capabilities: {
      writeEnabled: process.env.ADO_WRITE_ENABLED === "1"
    }
  });

  const settingsAdapter = new FileContextSettingsAdapter(contextFilePath);
  const contextStore = new AdoContextStore(settingsAdapter);
  const controller = new QueryIntakeController(contextStore, queryFlow.runQueryIntake);
  const distRootPath = path.resolve(params.distRootPath ?? path.join(process.cwd(), "dist"));
  const azLoginRunner = params.azLoginRunner ?? defaultAzLoginRunner;
  const azCliPathResolver = params.azCliPathResolver ?? resolveAzCliExecutablePath;

  const server = createServer(async (req, res) => {
    await route(
      req,
      res,
      controller,
      queryFlow.submitWriteCommand,
      queryFlow.capabilities.writeEnabled,
      distRootPath,
      verboseLogs,
      adoCommLogStore,
      azLoginRunner,
      azCliPathResolver
    );
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
  submitWriteCommand: SubmitWriteCommandUseCase,
  writeEnabled: boolean,
  distRootPath: string,
  verboseLogs: boolean,
  adoCommLogStore: AdoCommLogStore,
  azLoginRunner: AzLoginRunner,
  azCliPathResolver: AzCliPathResolver
): Promise<void> {
  const method = req.method ?? "GET";
  const url = sanitizeIncomingPath(req.url);

  logVerboseRoute(verboseLogs, method, url.pathname);

  if (isQueryIntakeRoute(method, url.pathname)) {
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

    logVerboseIntake(verboseLogs, {
      statusCode: result.statusCode,
      preflightStatus: result.preflightStatus,
      uiState: result.uiState,
      activeQueryId: result.activeQueryId,
      errorCode: result.errorCode
    });

    writeJson(res, 200, result);
    return;
  }

  if (isAdoptScheduleRoute(method, url.pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const adopt = parseAdoptSchedulePayload(payload);

    if (!adopt) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide targetWorkItemId/startDate/endDate."
      });
      return;
    }

    try {
      const writeResult = await submitWriteCommand.execute({
        writeEnabled,
        command: {
          kind: "WORK_ITEM_PATCH",
          workItemId: adopt.targetWorkItemId,
          operations: [
            { op: "add", path: "/fields/Microsoft.VSTS.Scheduling.StartDate", value: adopt.startDate },
            { op: "add", path: "/fields/Microsoft.VSTS.Scheduling.TargetDate", value: adopt.endDate }
          ]
        }
      });

      if (!writeResult.accepted) {
        writeJson(res, 403, {
          code: "WRITE_DISABLED",
          message: "Writeback is disabled.",
          result: writeResult
        });
        return;
      }

      writeJson(res, 200, writeResult);
      return;
    } catch (error) {
      writeJson(res, 500, {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Unable to patch work item."
      });
      return;
    }
  }

  if (isUpdateDetailsRoute(method, url.pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const update = parseUpdateDetailsPayload(payload);

    if (!update) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide targetWorkItemId/title/descriptionHtml."
      });
      return;
    }

    try {
      const writeResult = await submitWriteCommand.execute({
        writeEnabled,
        command: {
          kind: "WORK_ITEM_PATCH",
          workItemId: update.targetWorkItemId,
          operations: [
            { op: "add", path: "/fields/System.Title", value: update.title },
            { op: "add", path: "/fields/System.Description", value: update.descriptionHtml }
          ]
        }
      });

      if (!writeResult.accepted) {
        writeJson(res, 403, {
          code: "WRITE_DISABLED",
          message: "Writeback is disabled.",
          result: writeResult
        });
        return;
      }

      writeJson(res, 200, writeResult);
      return;
    } catch (error) {
      writeJson(res, 500, {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Unable to patch work item."
      });
      return;
    }
  }

  if (isAzLoginRoute(method, url.pathname)) {
    try {
      const result = await azLoginRunner();
      writeJson(res, 200, {
        status: "OK",
        message: result.message
      });
      return;
    } catch (error) {
      writeJson(res, 500, {
        code: "AZ_LOGIN_FAILED",
        message: error instanceof Error ? error.message : "Azure CLI login failed."
      });
      return;
    }
  }

  if (isAzCliPathRoute(method, url.pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const azCliPath = parseAzCliPathPayload(payload);

    if (azCliPath === null) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide path as a string."
      });
      return;
    }

    if (azCliPath.length > 0) {
      process.env.ADO_AZ_CLI_PATH = azCliPath;
    } else {
      const autoDetectedPath = await azCliPathResolver();
      if (autoDetectedPath && autoDetectedPath !== "az") {
        process.env.ADO_AZ_CLI_PATH = autoDetectedPath;
      } else {
        delete process.env.ADO_AZ_CLI_PATH;
      }
    }

    writeJson(res, 200, {
      status: "OK",
      path: process.env.ADO_AZ_CLI_PATH ?? "az"
    });
    return;
  }

  if (isAdoCommLogRoute(method, url.pathname)) {
    writeAdoCommLogsResponse(res, adoCommLogStore, url);
    return;
  }

  if (isHealthRoute(method, url.pathname)) {
    writeJson(res, 200, { status: "ok" });
    return;
  }

  if (isRootRoute(method, url.pathname)) {
    writeHtml(res, 200, ROOT_HTML);
    return;
  }

  if (isDistRoute(method, url.pathname)) {
    await serveDistAsset(url.pathname, distRootPath, res);
    return;
  }

  routeNotFound(res);
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

function parseAdoptSchedulePayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; startDate: string; endDate: string } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const startDate = input.startDate;
  const endDate = input.endDate;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    targetWorkItemId <= 0 ||
    typeof startDate !== "string" ||
    startDate.trim().length === 0 ||
    typeof endDate !== "string" ||
    endDate.trim().length === 0
  ) {
    return null;
  }

  return {
    targetWorkItemId,
    startDate,
    endDate
  };
}

function parseUpdateDetailsPayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; title: string; descriptionHtml: string } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const title = input.title;
  const descriptionHtml = input.descriptionHtml;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    typeof title !== "string" ||
    title.trim().length === 0 ||
    typeof descriptionHtml !== "string"
  ) {
    return null;
  }

  return {
    targetWorkItemId,
    title: title.trim(),
    descriptionHtml
  };
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

function parseAzCliPathPayload(input: Record<string, unknown> | null): string | null {
  if (!input || typeof input.path !== "string") {
    return null;
  }

  return input.path.trim();
}

async function defaultAzLoginRunner(): Promise<{ message: string }> {
  try {
    const azExecutable = await resolveAzCliExecutablePath();
    await execAsync(buildAzCommand(azExecutable, ["login", "--use-device-code", "--output", "none"]), {
      timeout: 5 * 60_000,
      windowsHide: true
    });
    return {
      message: "Azure CLI login completed. Retry query intake."
    };
  } catch (error: unknown) {
    const nodeError = error as {
      stdout?: string;
      stderr?: string;
    };
    const details = sanitizeLogText(`${nodeError.stderr ?? ""} ${nodeError.stdout ?? ""}`.trim());
    const suffix = details ? ` Details: ${details.slice(0, 300)}` : "";
    throw new Error(`Azure CLI login failed.${suffix}`);
  }
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

function sanitizeLogText(input: string): string {
  return input.replace(/[\r\n\t]+/g, " ").trim();
}
