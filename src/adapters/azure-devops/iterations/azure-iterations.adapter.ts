import type { AdoContext } from "../../../application/ports/context-settings.port.js";
import type { IterationMetadata, IterationsPort } from "../../../application/ports/iterations.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";
import type { HttpClient } from "../queries/azure-query-runtime.adapter.js";

const API_VERSION = "7.1";
const MAX_RETRY_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 2000;

type HttpResponse = {
  status: number;
  json: unknown;
  headers?: Record<string, string | undefined>;
};

export class AzureIterationsAdapter implements IterationsPort {
  public constructor(
    private readonly httpClient: HttpClient,
    private readonly contextStore: AdoContextStore
  ) {}

  public async listIterations(context?: AdoContext): Promise<IterationMetadata[]> {
    const activeContext = await this.resolveContext(context);
    const url = `https://dev.azure.com/${activeContext.organization}/${activeContext.project}/_apis/wit/classificationnodes/Iterations?$depth=10&api-version=${API_VERSION}`;

    let response: HttpResponse;
    try {
      response = await this.fetchWithRetry(url);
    } catch (error) {
      throw new Error(`ITERATIONS_LIST_FAILED:${toTransportFailureHint(error)}`);
    }

    if (response.status !== 200) {
      throw new Error(buildHttpFailureCode("ITERATIONS_LIST_FAILED", response));
    }

    return normalizeClassificationIterations(response.json);
  }

  private async resolveContext(context?: AdoContext): Promise<AdoContext> {
    if (context) {
      return context;
    }
    const stored = await this.contextStore.getActiveContext();
    if (!stored) {
      throw new Error("NO_CONTEXT");
    }
    return stored;
  }

  private async fetchWithRetry(url: string): Promise<HttpResponse> {
    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }

      try {
        const response = await this.httpClient.get(url);
        if (response.status === 200) {
          return response;
        }
        if (response.status !== 429 && response.status !== 503) {
          return response;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("ITERATIONS_FETCH_FAILED");
  }
}

function extractDateString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

function toTransportFailureHint(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildHttpFailureCode(prefix: string, response: HttpResponse): string {
  return `${prefix}:HTTP_${response.status}`;
}

function normalizeClassificationIterations(raw: unknown): IterationMetadata[] {
  const result: IterationMetadata[] = [];
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const traverse = (node: unknown, parentPath: string = "") => {
    if (!node || typeof node !== "object") {
      return;
    }

    const currentNode = node as Record<string, unknown>;
    const name = String(currentNode.name ?? "");
    const attributes = currentNode.attributes as Record<string, unknown> | undefined;
    const fullPath = parentPath ? `${parentPath}\\${name}` : name;

    let startDate: string | null = null;
    let endDate: string | null = null;

    if (attributes) {
      startDate = extractDateString(attributes.startDate);
      endDate = extractDateString(attributes.finishDate);
    }

    result.push({
      id: String(currentNode.identifier ?? fullPath),
      name,
      path: fullPath,
      startDate,
      endDate
    });

    const children = currentNode.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        traverse(child, fullPath);
      }
    }
  };

  traverse(raw);

  return result;
}
