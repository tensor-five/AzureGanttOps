import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { buildAzCommand, resolveAzCliExecutablePath } from "../../shared/utils/azure-cli-path.js";
import {
  LowdbUserPreferencesAdapter,
  type UserPreferences
} from "../../adapters/persistence/settings/lowdb-user-preferences.adapter.js";

import { AdoContextStore } from "../config/ado-context.store.js";
import { FileContextSettingsAdapter } from "../../adapters/persistence/settings/file-context-settings.adapter.js";
import type { HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";
import { createPhase1QueryFlow } from "../composition/phase1-query-flow.js";
import { QueryIntakeController } from "../../features/query-switching/query-intake.controller.js";
import type { SubmitWriteCommandUseCase } from "../../application/use-cases/submit-write-command.use-case.js";

const THEME_MODE_STORAGE_KEY = "azure-ganttops.theme-mode.v1";
const FAVICON_ICO_BASE64 =
  "AAABAAEAEBAQAAAAAAAoAQAAFgAAACgAAAAQAAAAIAAAAAEABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const FAVICON_ICO_BUFFER = Buffer.from(FAVICON_ICO_BASE64, "base64");
const FAVICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs>',
  '<rect width="64" height="64" rx="14" fill="url(#bg)"/>',
  '<g opacity="0.22" stroke="#94a3b8" stroke-width="1">',
  '<path d="M12 18H52M12 28H52M12 38H52M12 48H52"/>',
  '<path d="M16 14V52M28 14V52M40 14V52M52 14V52"/>',
  "</g>",
  '<rect x="14" y="16" width="22" height="6" rx="3" fill="#22d3ee"/>',
  '<rect x="24" y="26" width="26" height="6" rx="3" fill="#38bdf8"/>',
  '<rect x="18" y="36" width="18" height="6" rx="3" fill="#60a5fa"/>',
  '<rect x="32" y="46" width="16" height="6" rx="3" fill="#93c5fd"/>',
  "</svg>"
].join("");
const FAVICON_SVG_BUFFER = Buffer.from(FAVICON_SVG, "utf8");

const ROOT_HTML = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Azure DevOps Query-Driven Gantt</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
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
type WorkItemStateOption = {
  name: string;
  color: string | null;
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
const DEPENDENCY_LINK_ROUTE_PATH = "/phase2/dependency-link";
const UPDATE_DETAILS_ROUTE_PATH = "/phase2/work-item-details-update";
const WORK_ITEM_STATE_OPTIONS_ROUTE_PATH = "/phase2/work-item-state-options";
const QUERY_DETAILS_ROUTE_PATH = "/phase2/query-details";
const AZ_LOGIN_ROUTE_PATH = "/phase2/az-login";
const AZ_CLI_PATH_ROUTE_PATH = "/phase2/az-cli-path";
const USER_PREFERENCES_ROUTE_PATH = "/phase2/user-preferences";
const QUERY_DETAILS_API_VERSION = "7.1";
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

function isFaviconRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/favicon.ico";
}

function isFaviconSvgRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/favicon.svg";
}

function isQueryIntakeRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === "/phase2/query-intake";
}

function isAdoptScheduleRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === ADOPT_SCHEDULE_ROUTE_PATH;
}

function isDependencyLinkRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === DEPENDENCY_LINK_ROUTE_PATH;
}

function isUpdateDetailsRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === UPDATE_DETAILS_ROUTE_PATH;
}

function isWorkItemStateOptionsRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === WORK_ITEM_STATE_OPTIONS_ROUTE_PATH;
}

function isQueryDetailsRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === QUERY_DETAILS_ROUTE_PATH;
}

function isAzLoginRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === AZ_LOGIN_ROUTE_PATH;
}

function isAzCliPathRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === AZ_CLI_PATH_ROUTE_PATH;
}

function isUserPreferencesGetRoute(method: string, pathname: string): boolean {
  return method === "GET" && pathname === USER_PREFERENCES_ROUTE_PATH;
}

function isUserPreferencesPostRoute(method: string, pathname: string): boolean {
  return method === "POST" && pathname === USER_PREFERENCES_ROUTE_PATH;
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
  userPreferencesFilePath?: string;
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
  const userPreferencesFilePath =
    params.userPreferencesFilePath ?? path.join(path.dirname(contextFilePath), "user-preferences.json");
  const userId = resolveLocalUserId();

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
  const userPreferences = new LowdbUserPreferencesAdapter(userPreferencesFilePath, userId);
  const stateOptionsCacheByType = new Map<string, Promise<WorkItemStateOption[]>>();
  const workItemTypeCacheById = new Map<string, Promise<string | null>>();
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
      contextStore,
      instrumentedHttpClient,
      stateOptionsCacheByType,
      workItemTypeCacheById,
      userPreferences,
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
  contextStore: AdoContextStore,
  httpClient: HttpClient,
  stateOptionsCacheByType: Map<string, Promise<WorkItemStateOption[]>>,
  workItemTypeCacheById: Map<string, Promise<string | null>>,
  userPreferences: LowdbUserPreferencesAdapter,
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

  if (isDependencyLinkRoute(method, url.pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const link = parseDependencyLinkPayload(payload);

    if (!link) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide predecessorWorkItemId/successorWorkItemId/action."
      });
      return;
    }

    try {
      const writeResult = await submitWriteCommand.execute({
        writeEnabled,
        command: {
          kind: "DEPENDENCY_LINK",
          sourceId: link.predecessorWorkItemId,
          targetId: link.successorWorkItemId,
          relation: "System.LinkTypes.Dependency-Forward",
          action: link.action
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
        message: error instanceof Error ? error.message : "Unable to update dependency link."
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
        message: "Provide targetWorkItemId/title/descriptionHtml/state."
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
            { op: "add", path: "/fields/System.Description", value: update.descriptionHtml },
            { op: "add", path: "/fields/System.State", value: update.state }
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

  if (isWorkItemStateOptionsRoute(method, url.pathname)) {
    const targetWorkItemId = parseTargetWorkItemIdFromQuery(url);
    if (!targetWorkItemId) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide targetWorkItemId query param."
      });
      return;
    }

    try {
      const states = await fetchAllowedStateCodesForWorkItem({
        workItemId: targetWorkItemId,
        contextStore,
        httpClient,
        stateOptionsCacheByType,
        workItemTypeCacheById
      });
      writeJson(res, 200, { states });
      return;
    } catch (error) {
      writeJson(res, 500, {
        code: "STATE_OPTIONS_FAILED",
        message: error instanceof Error ? error.message : "Unable to fetch allowed work item states."
      });
      return;
    }
  }

  if (isQueryDetailsRoute(method, url.pathname)) {
    const queryId = parseQueryIdFromQuery(url);
    if (!queryId) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide queryId query param."
      });
      return;
    }

    try {
      const queryDetails = await fetchQueryDetails({
        queryId,
        contextStore,
        httpClient
      });
      writeJson(res, 200, queryDetails);
      return;
    } catch (error) {
      if (error instanceof Error && error.message === "CONTEXT_REQUIRED") {
        writeJson(res, 400, {
          code: "CONTEXT_REQUIRED",
          message: "Set Azure DevOps organization and project first."
        });
        return;
      }

      if (error instanceof Error && error.message === "QUERY_NOT_FOUND") {
        writeJson(res, 404, {
          code: "QUERY_NOT_FOUND",
          message: "Query not found."
        });
        return;
      }

      writeJson(res, 500, {
        code: "QUERY_DETAILS_FAILED",
        message: error instanceof Error ? error.message : "Unable to fetch query details."
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

  if (isUserPreferencesGetRoute(method, url.pathname)) {
    try {
      const preferences = await userPreferences.getPreferences();
      writeJson(res, 200, {
        preferences
      });
      return;
    } catch (error) {
      writeJson(res, 500, {
        code: "PREFERENCES_READ_FAILED",
        message: error instanceof Error ? error.message : "Unable to read user preferences."
      });
      return;
    }
  }

  if (isUserPreferencesPostRoute(method, url.pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const patch = parseUserPreferencesPatch(payload);

    if (!patch) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide preferences as an object."
      });
      return;
    }

    try {
      const preferences = await userPreferences.mergePreferences(patch);
      writeJson(res, 200, {
        status: "OK",
        preferences
      });
      return;
    } catch (error) {
      writeJson(res, 500, {
        code: "PREFERENCES_WRITE_FAILED",
        message: error instanceof Error ? error.message : "Unable to persist user preferences."
      });
      return;
    }
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

  if (isFaviconRoute(method, url.pathname)) {
    writeFavicon(res);
    return;
  }

  if (isFaviconSvgRoute(method, url.pathname)) {
    writeFaviconSvg(res);
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

function parseUserPreferencesPatch(payload: Record<string, unknown> | null): UserPreferences | null {
  if (!payload) {
    return null;
  }

  const raw = payload.preferences;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  return raw as UserPreferences;
}

function resolveLocalUserId(): string {
  const fromEnv = process.env.USER ?? process.env.USERNAME;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  try {
    return os.userInfo().username;
  } catch {
    return "local-user";
  }
}

function parseTargetWorkItemIdFromQuery(url: URL): number | null {
  const raw = url.searchParams.get("targetWorkItemId");
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseQueryIdFromQuery(url: URL): string | null {
  const raw = url.searchParams.get("queryId");
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fetchQueryDetails(input: {
  queryId: string;
  contextStore: AdoContextStore;
  httpClient: HttpClient;
}): Promise<{ id: string; name: string; path: string }> {
  const context = await input.contextStore.getActiveContext();
  if (!context) {
    throw new Error("CONTEXT_REQUIRED");
  }

  const url =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    `/_apis/wit/queries/${encodeURIComponent(input.queryId)}?$includeDeleted=true&api-version=${QUERY_DETAILS_API_VERSION}`;
  const response = await input.httpClient.get(url);

  if (response.status === 404) {
    throw new Error("QUERY_NOT_FOUND");
  }

  if (response.status !== 200) {
    throw new Error(`QUERY_DETAILS_FAILED:${response.status}`);
  }

  const payload = response.json as { id?: unknown; name?: unknown; path?: unknown };
  if (typeof payload.id !== "string" || typeof payload.name !== "string" || typeof payload.path !== "string") {
    throw new Error("MALFORMED_PAYLOAD");
  }

  return {
    id: payload.id,
    name: payload.name,
    path: payload.path
  };
}

async function fetchAllowedStateCodesForWorkItem(input: {
  workItemId: number;
  contextStore: AdoContextStore;
  httpClient: HttpClient;
  stateOptionsCacheByType: Map<string, Promise<WorkItemStateOption[]>>;
  workItemTypeCacheById: Map<string, Promise<string | null>>;
}): Promise<WorkItemStateOption[]> {
  const context = await input.contextStore.getActiveContext();
  if (!context) {
    throw new Error("ADO_CONTEXT_MISSING");
  }

  const workItemType = await getCachedWorkItemType({
    workItemId: input.workItemId,
    context,
    httpClient: input.httpClient,
    cache: input.workItemTypeCacheById
  });
  if (!workItemType) {
    return [];
  }

  return getCachedWorkItemTypeStates({
    workItemType,
    context,
    httpClient: input.httpClient,
    cache: input.stateOptionsCacheByType
  });
}

async function getCachedWorkItemType(input: {
  workItemId: number;
  context: { organization: string; project: string };
  httpClient: HttpClient;
  cache: Map<string, Promise<string | null>>;
}): Promise<string | null> {
  const cacheKey = `${input.context.organization}/${input.context.project}/${input.workItemId}`;
  const existing = input.cache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const workItemUrl =
      `https://dev.azure.com/${encodeURIComponent(input.context.organization)}/${encodeURIComponent(input.context.project)}` +
      `/_apis/wit/workitems/${input.workItemId}?fields=System.WorkItemType&api-version=7.1`;
    const workItemResponse = await input.httpClient.get(workItemUrl);
    if (workItemResponse.status < 200 || workItemResponse.status >= 300) {
      throw new Error("WORK_ITEM_FETCH_FAILED");
    }

    return extractWorkItemType(workItemResponse.json);
  })();

  input.cache.set(cacheKey, promise);
  return promise;
}

async function getCachedWorkItemTypeStates(input: {
  workItemType: string;
  context: { organization: string; project: string };
  httpClient: HttpClient;
  cache: Map<string, Promise<WorkItemStateOption[]>>;
}): Promise<WorkItemStateOption[]> {
  const cacheKey = `${input.context.organization}/${input.context.project}/${input.workItemType.toLowerCase()}`;
  const existing = input.cache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const statesUrl =
      `https://dev.azure.com/${encodeURIComponent(input.context.organization)}/${encodeURIComponent(input.context.project)}` +
      `/_apis/wit/workitemtypes/${encodeURIComponent(input.workItemType)}/states?api-version=7.1`;
    const statesResponse = await input.httpClient.get(statesUrl);
    if (statesResponse.status < 200 || statesResponse.status >= 300) {
      throw new Error("WORK_ITEM_STATES_FETCH_FAILED");
    }

    return extractStateCodes(statesResponse.json);
  })();

  input.cache.set(cacheKey, promise);
  return promise;
}

function extractWorkItemType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const fields = (payload as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object") {
    return null;
  }

  const workItemType = (fields as Record<string, unknown>)["System.WorkItemType"];
  if (typeof workItemType !== "string") {
    return null;
  }

  const trimmed = workItemType.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractStateCodes(payload: unknown): WorkItemStateOption[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const value = (payload as { value?: unknown }).value;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const name = (entry as Record<string, unknown>).name;
      const color = (entry as Record<string, unknown>).color;
      if (typeof name !== "string") {
        return null;
      }

      const trimmed = name.trim();
      return trimmed.length > 0 ? { name: trimmed, color: typeof color === "string" ? color : null } : null;
    })
    .filter((entry): entry is WorkItemStateOption => entry !== null);
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

function parseDependencyLinkPayload(
  input: Record<string, unknown> | null
): { predecessorWorkItemId: number; successorWorkItemId: number; action: "add" | "remove" } | null {
  if (!input) {
    return null;
  }

  const predecessorWorkItemId = input.predecessorWorkItemId;
  const successorWorkItemId = input.successorWorkItemId;
  const action = input.action;

  if (
    typeof predecessorWorkItemId !== "number" ||
    !Number.isFinite(predecessorWorkItemId) ||
    predecessorWorkItemId <= 0 ||
    typeof successorWorkItemId !== "number" ||
    !Number.isFinite(successorWorkItemId) ||
    successorWorkItemId <= 0 ||
    predecessorWorkItemId === successorWorkItemId ||
    (action !== "add" && action !== "remove")
  ) {
    return null;
  }

  return {
    predecessorWorkItemId,
    successorWorkItemId,
    action
  };
}

function parseUpdateDetailsPayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; title: string; descriptionHtml: string; state: string } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const title = input.title;
  const descriptionHtml = input.descriptionHtml;
  const state = input.state;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    typeof title !== "string" ||
    title.trim().length === 0 ||
    typeof descriptionHtml !== "string" ||
    typeof state !== "string" ||
    state.trim().length === 0
  ) {
    return null;
  }

  return {
    targetWorkItemId,
    title: title.trim(),
    descriptionHtml,
    state: state.trim()
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

function writeFavicon(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("content-type", "image/x-icon");
  res.end(FAVICON_ICO_BUFFER);
}

function writeFaviconSvg(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("content-type", "image/svg+xml; charset=utf-8");
  res.end(FAVICON_SVG_BUFFER);
}

function sanitizeLogText(input: string): string {
  return input.replace(/[\r\n\t]+/g, " ").trim();
}
