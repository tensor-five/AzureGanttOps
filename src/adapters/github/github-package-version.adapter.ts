import type { AppVersionSourcePort } from "../../application/ports/app-version-source.port.js";

export type GithubPackageVersionFailureReason =
  | "http_error"
  | "timeout"
  | "invalid_response"
  | "request_failed";

export class GithubPackageVersionError extends Error {
  readonly reason: GithubPackageVersionFailureReason;

  constructor(reason: GithubPackageVersionFailureReason, message: string) {
    super(message);
    this.name = "GithubPackageVersionError";
    this.reason = reason;
  }
}

export type GithubPackageVersionAdapterParams = {
  url?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_PACKAGE_JSON_URL =
  "https://raw.githubusercontent.com/tensor-five/AzureGanttOps/main/package.json";
const DEFAULT_TIMEOUT_MS = 3000;

export class GithubPackageVersionAdapter implements AppVersionSourcePort {
  readonly source = "github" as const;

  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(params: GithubPackageVersionAdapterParams = {}) {
    this.url = params.url ?? DEFAULT_PACKAGE_JSON_URL;
    this.timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = params.fetchImpl ?? fetch;
  }

  async loadLatestVersion(): Promise<string> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.url, {
        method: "GET",
        headers: {
          accept: "application/json"
        },
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new GithubPackageVersionError(
          "http_error",
          `GitHub package version request failed with HTTP ${response.status}.`
        );
      }

      const payload = (await response.json()) as unknown;
      const version = readPackageVersion(payload);
      if (!version) {
        throw new GithubPackageVersionError("invalid_response", "GitHub package.json does not contain a version.");
      }

      return version;
    } catch (error) {
      if (error instanceof GithubPackageVersionError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new GithubPackageVersionError("timeout", "GitHub package version request timed out.");
      }

      throw new GithubPackageVersionError("request_failed", "GitHub package version request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function readPackageVersion(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const version = (payload as { version?: unknown }).version;
  return typeof version === "string" && version.trim().length > 0 ? version.trim() : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
