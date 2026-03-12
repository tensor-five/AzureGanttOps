import { createHttpServer } from "./http-server.js";
import { exec } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildAzCommand, resolveAzCliExecutablePath } from "../../shared/utils/azure-cli-path.js";

type HeaderBag = Record<string, string | undefined>;

type FetchResponse = {
  status: number;
  json: unknown;
  headers: HeaderBag;
};

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const ADO_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";
const TOKEN_REFRESH_SKEW_MS = 120_000;
const TOKEN_COMMAND_TIMEOUT_MS = 60_000;
const PORT = Number(process.env.PORT ?? "8080");

if (process.env.ADO_VERBOSE_LOGS !== "1") {
  process.env.ADO_VERBOSE_LOGS = "1";
}
if (process.env.ADO_WRITE_ENABLED !== "1") {
  process.env.ADO_WRITE_ENABLED = "1";
}

async function main(): Promise<void> {
  const detectedAzCliPath = await resolveAzCliExecutablePath();
  if (!process.env.ADO_AZ_CLI_PATH && detectedAzCliPath !== "az") {
    process.env.ADO_AZ_CLI_PATH = detectedAzCliPath;
  }

  if (process.env.ADO_VERBOSE_LOGS === "1") {
    console.log("[ado-runtime] ADO_VERBOSE_LOGS=1");
    console.log(`[ado-runtime] ADO_WRITE_ENABLED=${process.env.ADO_WRITE_ENABLED === "1" ? "1" : "0"}`);
    console.log(`[ado-runtime] ADO_AZ_CLI_PATH=${detectedAzCliPath}`);
  }

  const authHeaderProvider = createAdoAuthHeaderProvider();

  const server = createHttpServer({
    port: PORT,
    httpClient: {
      get: async (url: string): Promise<FetchResponse> => {
        try {
          const response = await fetch(url, {
            method: "GET",
            redirect: "manual",
            headers: {
              authorization: await authHeaderProvider.getHeader(),
              accept: "application/json"
            }
          });
          return {
            status: response.status,
            json: await parseResponseBody(response),
            headers: toHeaders(response.headers)
          };
        } catch (error) {
          if (process.env.ADO_VERBOSE_LOGS === "1") {
            console.log(`[ado-runtime] http transport error method=GET url=${url} error=${formatError(error)}`);
          }
          throw error;
        }
      },
      patch: async (
        url: string,
        body: unknown,
        headers?: Record<string, string>
      ): Promise<FetchResponse> => {
        try {
          const response = await fetch(url, {
            method: "PATCH",
            redirect: "manual",
            headers: {
              authorization: await authHeaderProvider.getHeader(),
              accept: "application/json",
              "content-type": "application/json-patch+json",
              ...(headers ?? {})
            },
            body: JSON.stringify(body)
          });
          return {
            status: response.status,
            json: await parseResponseBody(response),
            headers: toHeaders(response.headers)
          };
        } catch (error) {
          if (process.env.ADO_VERBOSE_LOGS === "1") {
            console.log(`[ado-runtime] http transport error method=PATCH url=${url} error=${formatError(error)}`);
          }
          throw error;
        }
      }
    }
  });

  async function parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (text.trim().length === 0) {
      return {};
    }

    const looksJson = contentType.includes("application/json") || contentType.includes("+json");

    if (looksJson) {
      try {
        return JSON.parse(text);
      } catch {
        return {
          parseError: "INVALID_JSON",
          rawText: text.slice(0, 2000)
        };
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        rawText: text.slice(0, 2000)
      };
    }
  }

  const closeServer = () => {
    void server.close();
    process.exit(0);
  };

  process.on("SIGINT", closeServer);
  process.on("SIGTERM", closeServer);

  console.log(`Local server listening on http://127.0.0.1:${PORT}`);
}

function createAdoAuthHeaderProvider(): {
  getHeader: () => Promise<string>;
} {
  const envPat = process.env.ADO_PAT ?? process.env.AZURE_DEVOPS_EXT_PAT;
  if (envPat && envPat.trim().length > 0) {
    const encoded = Buffer.from(`:${envPat.trim()}`).toString("base64");
    logAuthMode("init", "pat-basic");
    return {
      getHeader: async () => `Basic ${encoded}`
    };
  }
  logAuthMode("init", "cli-bearer");

  let cachedBearerToken: string | null = null;
  let cachedExpiryEpochMs = 0;

  return {
    getHeader: async () => {
      const now = Date.now();
      const shouldRefresh =
        !cachedBearerToken || !cachedExpiryEpochMs || now >= cachedExpiryEpochMs - TOKEN_REFRESH_SKEW_MS;

      if (shouldRefresh) {
        const token = await resolveAzureCliAccessToken();
        cachedBearerToken = token;
        cachedExpiryEpochMs = extractJwtExpiryEpochMs(token) ?? now + 45 * 60 * 1000;
        logAuthMode("token_refresh", `cli-bearer exp=${new Date(cachedExpiryEpochMs).toISOString()}`);
      }

      return `Bearer ${cachedBearerToken}`;
    }
  };
}

function logAuthMode(event: string, mode: string): void {
  if (process.env.ADO_VERBOSE_LOGS === "1") {
    console.log(`[ado-runtime] auth ${event} mode=${mode}`);
  }
}

async function resolveAzureCliAccessToken(): Promise<string> {
  try {
    const azExecutable = await resolveAzCliExecutablePath();
    const azArgs = [
      "account",
      "get-access-token",
      "--resource",
      ADO_RESOURCE_ID,
      "--query",
      "accessToken",
      "-o",
      "tsv"
    ];
    const output =
      process.platform === "win32" && azExecutable.toLowerCase().endsWith(".cmd")
        ? await execAsync(buildAzCommand(azExecutable, azArgs), {
            timeout: TOKEN_COMMAND_TIMEOUT_MS,
            windowsHide: true
          })
        : await execFileAsync(azExecutable, azArgs, {
            timeout: TOKEN_COMMAND_TIMEOUT_MS,
            windowsHide: true
          });

    const token = (output.stdout ?? "").trim();

    if (!token) {
      throw new Error("EMPTY_TOKEN");
    }

    return token;
  } catch (error: unknown) {
    const nodeError = error as {
      message?: string;
      code?: string;
      signal?: string;
      stderr?: string;
      stdout?: string;
    };
    const detail = [nodeError.message, nodeError.code, nodeError.signal, nodeError.stderr, nodeError.stdout]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim();
    const hint = detail.length > 0 ? ` Details: ${detail.slice(0, 300)}` : "";
    throw new Error(`ADO_AUTH_REQUIRED: Set ADO_PAT/AZURE_DEVOPS_EXT_PAT or run 'az login'.${hint}`);
  }
}

function extractJwtExpiryEpochMs(token: string): number | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadRaw = Buffer.from(segments[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadRaw) as { exp?: unknown };
    if (typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }

  return null;
}

function toHeaders(headers: Headers): HeaderBag {
  const values: HeaderBag = {};

  headers.forEach((value, key) => {
    values[key] = value;
  });

  return values;
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  return error.message.replace(/[\r\n\t]+/g, " ").trim();
}

void main();
