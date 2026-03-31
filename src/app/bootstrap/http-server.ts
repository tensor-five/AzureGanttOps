import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveAzCliExecutablePath } from "../../shared/utils/azure-cli-path.js";
import {
  LowdbUserPreferencesAdapter
} from "../../adapters/persistence/settings/lowdb-user-preferences.adapter.js";

import { AdoContextStore } from "../config/ado-context.store.js";
import { FileContextSettingsAdapter } from "../../adapters/persistence/settings/file-context-settings.adapter.js";
import type { HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";
import { createPhase1QueryFlow } from "../composition/phase1-query-flow.js";
import { QueryIntakeController } from "../../features/query-switching/query-intake.controller.js";
import type { SubmitWriteCommandUseCase } from "../../application/use-cases/submit-write-command.use-case.js";
import {
  parseAdoptSchedulePayload,
  parseAzCliPathPayload,
  parseDependencyLinkPayload,
  parseMappingProfileUpsert,
  parsePayload,
  parseQueryIdFromQuery,
  parseTargetWorkItemIdFromQuery,
  parseUpdateDetailsPayload,
  parseUserPreferencesPatch
} from "./http-server-request-parsing.js";
import {
  fetchAllowedStateCodesForWorkItem,
  fetchQueryDetails
} from "./http-server-query-resolvers.js";

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
    <meta name="ado-csrf-token" content="__ADO_CSRF_TOKEN__" />
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
const SENSITIVE_BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const SENSITIVE_JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.?[A-Za-z0-9_-]*\b/g;
const SENSITIVE_KEY_VALUE_PATTERN =
  /\b(token|secret|password|pat|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization)\b(\s*[:=]\s*)(["'])?([^\s,"'}\]]{6,})\3?/gi;
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
const ADO_CSRF_HEADER = "x-ado-csrf-token";
const ADO_CSRF_MISSING_OR_INVALID = {
  code: "CSRF_INVALID",
  message: "Missing or invalid CSRF protection."
} as const;
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
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; " +
  "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'";
const ADO_COMM_ROUTE_QUERY_AFTER_SEQ = "afterSeq";
const ADO_COMM_ROUTE_QUERY_LIMIT = "limit";
const ADO_COMM_LOG_VERBOSE_PREFIX = "[ado-runtime]";
const ADO_COMM_ROUTE_NOT_FOUND = {
  code: "NOT_FOUND",
  message: "Route not found."
} as const;
const execFileAsync = promisify(execFile);

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
  const sanitized = sanitizeLogText(input)
    .replace(SENSITIVE_BEARER_PATTERN, `Bearer ${ADO_COMM_REDACTED}`)
    .replace(SENSITIVE_JWT_PATTERN, ADO_COMM_REDACTED)
    .replace(SENSITIVE_KEY_VALUE_PATTERN, (_match, key: string, separator: string) => `${key}${separator}${ADO_COMM_REDACTED}`)
    .replace(SENSITIVE_INLINE_PATTERN, ADO_COMM_REDACTED);

  return sanitized.slice(0, ADO_COMM_LOG_PREVIEW_MAX);
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
    const payloadPreview = sanitizePreviewForLog(JSON.stringify(response.json));
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

function isCsrfProtectedRoute(method: string, pathname: string): boolean {
  return (
    isAzLoginRoute(method, pathname) ||
    isAzCliPathRoute(method, pathname) ||
    isUserPreferencesPostRoute(method, pathname) ||
    isAdoptScheduleRoute(method, pathname) ||
    isDependencyLinkRoute(method, pathname) ||
    isUpdateDetailsRoute(method, pathname)
  );
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
  const csrfToken = createCsrfToken();

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
      azCliPathResolver,
      csrfToken
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
  azCliPathResolver: AzCliPathResolver,
  csrfToken: string
): Promise<void> {
  const method = req.method ?? "GET";
  const url = sanitizeIncomingPath(req.url);

  logVerboseRoute(verboseLogs, method, url.pathname);

  if (isCsrfProtectedRoute(method, url.pathname) && !isValidCsrfRequest(req, csrfToken)) {
    writeJson(res, 403, ADO_CSRF_MISSING_OR_INVALID);
    return;
  }

  if (
    await handleQueryDomainRoute(req, res, method, url, {
      controller,
      contextStore,
      httpClient,
      stateOptionsCacheByType,
      workItemTypeCacheById,
      verboseLogs
    })
  ) {
    return;
  }

  if (await handleTimelineWritesRoute(req, res, method, url.pathname, { submitWriteCommand, writeEnabled })) {
    return;
  }

  if (
    await handlePreferencesRoute(req, res, method, url.pathname, {
      userPreferences,
      azLoginRunner,
      azCliPathResolver
    })
  ) {
    return;
  }

  if (
    await handleDiagnosticsAndAssetsRoute(req, res, method, url, {
      adoCommLogStore,
      distRootPath,
      csrfToken
    })
  ) {
    return;
  }

  routeNotFound(res);
}

type QueryDomainDeps = {
  controller: QueryIntakeController;
  contextStore: AdoContextStore;
  httpClient: HttpClient;
  stateOptionsCacheByType: Map<string, Promise<WorkItemStateOption[]>>;
  workItemTypeCacheById: Map<string, Promise<string | null>>;
  verboseLogs: boolean;
};

async function handleQueryDomainRoute(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  url: URL,
  deps: QueryDomainDeps
): Promise<boolean> {
  if (isQueryIntakeRoute(method, url.pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);

    if (!payload || typeof payload.queryInput !== "string") {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide queryInput as a string."
      });
      return true;
    }

    try {
      const result = await deps.controller.submit({
        queryInput: payload.queryInput,
        mappingProfileId: typeof payload.mappingProfileId === "string" ? payload.mappingProfileId : undefined,
        mappingProfileUpsert: parseMappingProfileUpsert(payload.mappingProfileUpsert)
      });

      logVerboseIntake(deps.verboseLogs, {
        statusCode: result.statusCode,
        preflightStatus: result.preflightStatus,
        uiState: result.uiState,
        activeQueryId: result.activeQueryId,
        errorCode: result.errorCode
      });

      writeJson(res, 200, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown server error";
      console.error("[ado-runtime] query-intake unhandled error:", message);
      writeJson(res, 500, {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while processing the query intake."
      });
    }
    return true;
  }

  if (isWorkItemStateOptionsRoute(method, url.pathname)) {
    const targetWorkItemId = parseTargetWorkItemIdFromQuery(url);
    if (!targetWorkItemId) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide targetWorkItemId query param."
      });
      return true;
    }

    try {
      const states = await fetchAllowedStateCodesForWorkItem({
        workItemId: targetWorkItemId,
        contextStore: deps.contextStore,
        httpClient: deps.httpClient,
        stateOptionsCacheByType: deps.stateOptionsCacheByType,
        workItemTypeCacheById: deps.workItemTypeCacheById
      });
      writeJson(res, 200, { states });
      return true;
    } catch (error) {
      writeJson(res, 500, {
        code: "STATE_OPTIONS_FAILED",
        message: error instanceof Error ? error.message : "Unable to fetch allowed work item states."
      });
      return true;
    }
  }

  if (isQueryDetailsRoute(method, url.pathname)) {
    const queryId = parseQueryIdFromQuery(url);
    if (!queryId) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide queryId query param."
      });
      return true;
    }

    try {
      const queryDetails = await fetchQueryDetails({
        queryId,
        contextStore: deps.contextStore,
        httpClient: deps.httpClient,
        apiVersion: QUERY_DETAILS_API_VERSION
      });
      writeJson(res, 200, queryDetails);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === "CONTEXT_REQUIRED") {
        writeJson(res, 400, {
          code: "CONTEXT_REQUIRED",
          message: "Set Azure DevOps organization and project first."
        });
        return true;
      }

      if (error instanceof Error && error.message === "QUERY_NOT_FOUND") {
        writeJson(res, 404, {
          code: "QUERY_NOT_FOUND",
          message: "Query not found."
        });
        return true;
      }

      writeJson(res, 500, {
        code: "QUERY_DETAILS_FAILED",
        message: error instanceof Error ? error.message : "Unable to fetch query details."
      });
      return true;
    }
  }

  return false;
}

type TimelineWritesDeps = {
  submitWriteCommand: SubmitWriteCommandUseCase;
  writeEnabled: boolean;
};

async function handleTimelineWritesRoute(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  pathname: string,
  deps: TimelineWritesDeps
): Promise<boolean> {
  if (isAdoptScheduleRoute(method, pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const adopt = parseAdoptSchedulePayload(payload);

    if (!adopt) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide targetWorkItemId/startDate/endDate."
      });
      return true;
    }

    try {
      const writeResult = await deps.submitWriteCommand.execute({
        writeEnabled: deps.writeEnabled,
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
        return true;
      }

      writeJson(res, 200, writeResult);
      return true;
    } catch (error) {
      writeJson(res, 500, {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Unable to patch work item."
      });
      return true;
    }
  }

  if (isDependencyLinkRoute(method, pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const link = parseDependencyLinkPayload(payload);

    if (!link) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide predecessorWorkItemId/successorWorkItemId/action."
      });
      return true;
    }

    try {
      const writeResult = await deps.submitWriteCommand.execute({
        writeEnabled: deps.writeEnabled,
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
        return true;
      }

      writeJson(res, 200, writeResult);
      return true;
    } catch (error) {
      writeJson(res, 500, {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Unable to update dependency link."
      });
      return true;
    }
  }

  if (isUpdateDetailsRoute(method, pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const update = parseUpdateDetailsPayload(payload);

    if (!update) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide targetWorkItemId/title/descriptionHtml/state."
      });
      return true;
    }

    try {
      const writeResult = await deps.submitWriteCommand.execute({
        writeEnabled: deps.writeEnabled,
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
        return true;
      }

      writeJson(res, 200, writeResult);
      return true;
    } catch (error) {
      writeJson(res, 500, {
        code: "WRITE_FAILED",
        message: error instanceof Error ? error.message : "Unable to patch work item."
      });
      return true;
    }
  }

  return false;
}

type PreferencesDeps = {
  userPreferences: LowdbUserPreferencesAdapter;
  azLoginRunner: AzLoginRunner;
  azCliPathResolver: AzCliPathResolver;
};

async function handlePreferencesRoute(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  pathname: string,
  deps: PreferencesDeps
): Promise<boolean> {
  if (isAzLoginRoute(method, pathname)) {
    try {
      const result = await deps.azLoginRunner();
      writeJson(res, 200, {
        status: "OK",
        message: result.message
      });
      return true;
    } catch (error) {
      writeJson(res, 500, {
        code: "AZ_LOGIN_FAILED",
        message: error instanceof Error ? error.message : "Azure CLI login failed."
      });
      return true;
    }
  }

  if (isAzCliPathRoute(method, pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const azCliPath = parseAzCliPathPayload(payload);

    if (azCliPath === null) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide path as a string."
      });
      return true;
    }

    if (azCliPath.length > 0) {
      writeJson(res, 403, {
        code: "FORBIDDEN",
        message: "Manual Azure CLI path override is disabled for security reasons."
      });
      return true;
    }

    const autoDetectedPath = await deps.azCliPathResolver();
    if (autoDetectedPath && autoDetectedPath !== "az") {
      process.env.ADO_AZ_CLI_PATH = autoDetectedPath;
    } else {
      delete process.env.ADO_AZ_CLI_PATH;
    }

    writeJson(res, 200, {
      status: "OK",
      path: process.env.ADO_AZ_CLI_PATH ?? "az"
    });
    return true;
  }

  if (isUserPreferencesGetRoute(method, pathname)) {
    try {
      const preferences = await deps.userPreferences.getPreferences();
      writeJson(res, 200, {
        preferences
      });
      return true;
    } catch (error) {
      writeJson(res, 500, {
        code: "PREFERENCES_READ_FAILED",
        message: error instanceof Error ? error.message : "Unable to read user preferences."
      });
      return true;
    }
  }

  if (isUserPreferencesPostRoute(method, pathname)) {
    const body = await readBody(req);
    const payload = parsePayload(body);
    const patch = parseUserPreferencesPatch(payload);

    if (!patch) {
      writeJson(res, 400, {
        code: "INVALID_INPUT",
        message: "Provide preferences as an object."
      });
      return true;
    }

    try {
      const preferences = await deps.userPreferences.mergePreferences(patch);
      writeJson(res, 200, {
        status: "OK",
        preferences
      });
      return true;
    } catch (error) {
      writeJson(res, 500, {
        code: "PREFERENCES_WRITE_FAILED",
        message: error instanceof Error ? error.message : "Unable to persist user preferences."
      });
      return true;
    }
  }

  return false;
}

type DiagnosticsRouteDeps = {
  adoCommLogStore: AdoCommLogStore;
  distRootPath: string;
  csrfToken: string;
};

async function handleDiagnosticsAndAssetsRoute(
  _req: IncomingMessage,
  res: ServerResponse,
  method: string,
  url: URL,
  deps: DiagnosticsRouteDeps
): Promise<boolean> {
  if (isAdoCommLogRoute(method, url.pathname)) {
    writeAdoCommLogsResponse(res, deps.adoCommLogStore, url);
    return true;
  }

  if (isHealthRoute(method, url.pathname)) {
    writeJson(res, 200, { status: "ok" });
    return true;
  }

  if (isRootRoute(method, url.pathname)) {
    writeHtml(res, 200, renderRootHtml(deps.csrfToken));
    return true;
  }

  if (isFaviconRoute(method, url.pathname)) {
    writeFavicon(res);
    return true;
  }

  if (isFaviconSvgRoute(method, url.pathname)) {
    writeFaviconSvg(res);
    return true;
  }

  if (isDistRoute(method, url.pathname)) {
    await serveDistAsset(url.pathname, deps.distRootPath, res);
    return true;
  }

  return false;
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

async function defaultAzLoginRunner(): Promise<{ message: string }> {
  try {
    const azExecutable = await resolveAzCliExecutablePath();
    await execFileAsync(azExecutable, ["login", "--use-device-code", "--output", "none"], {
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

function createCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

function renderRootHtml(csrfToken: string): string {
  return ROOT_HTML.replace("__ADO_CSRF_TOKEN__", csrfToken);
}

function isValidCsrfRequest(req: IncomingMessage, expectedToken: string): boolean {
  const tokenHeader = req.headers[ADO_CSRF_HEADER];
  const providedToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (typeof providedToken !== "string" || providedToken.length === 0 || providedToken !== expectedToken) {
    return false;
  }

  const host = readHeaderValue(req.headers.host);
  if (!host) {
    return false;
  }

  const expectedOrigin = `http://${host}`;
  const origin = readHeaderValue(req.headers.origin);
  if (origin && origin !== expectedOrigin) {
    return false;
  }

  const referer = readHeaderValue(req.headers.referer);
  if (referer && !referer.startsWith(`${expectedOrigin}/`) && referer !== expectedOrigin) {
    return false;
  }

  return true;
}

function readHeaderValue(header: string | string[] | undefined): string | null {
  if (Array.isArray(header)) {
    const first = header[0];
    return typeof first === "string" && first.length > 0 ? first : null;
  }

  return typeof header === "string" && header.length > 0 ? header : null;
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
    applySecurityHeaders(res);
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
  applySecurityHeaders(res);
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(payload);
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  applySecurityHeaders(res);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload)}\n`);
}

function writeFavicon(res: ServerResponse): void {
  res.statusCode = 200;
  applySecurityHeaders(res);
  res.setHeader("content-type", "image/x-icon");
  res.end(FAVICON_ICO_BUFFER);
}

function writeFaviconSvg(res: ServerResponse): void {
  res.statusCode = 200;
  applySecurityHeaders(res);
  res.setHeader("content-type", "image/svg+xml; charset=utf-8");
  res.end(FAVICON_SVG_BUFFER);
}

function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("content-security-policy", CONTENT_SECURITY_POLICY);
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
}

function sanitizeLogText(input: string): string {
  return input.replace(/[\r\n\t]+/g, " ").trim();
}
