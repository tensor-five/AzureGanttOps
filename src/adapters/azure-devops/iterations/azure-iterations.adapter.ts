import type { AdoContext } from "../../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";
import type { HttpClient } from "../queries/azure-query-runtime.adapter.js";

const API_VERSION = "7.1";
const MAX_RETRY_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 2000;

export type IterationMetadata = {
  id: string;
  name: string;
  path: string;
  startDate: string | null;
  endDate: string | null;
};

type HttpResponse = {
  status: number;
  json: unknown;
  headers?: Record<string, string | undefined>;
};

type RetriedResponse = {
  response: HttpResponse;
  retriedRequests: number;
};

type IterationListResult = {
  value?: Array<{
    id: string;
    name: string;
    path: string;
    startDate?: string;
    endDate?: string;
    finishDate?: string;
    attributes?: {
      startDate?: string;
      endDate?: string;
      finishDate?: string;
    };
  }>;
};

export interface IterationsPort {
  listIterations(context?: AdoContext): Promise<IterationMetadata[]>;
}

export class AzureIterationsAdapter implements IterationsPort {
  public constructor(
    private readonly httpClient: HttpClient,
    private readonly contextStore: AdoContextStore
  ) {}

  public async listIterations(context?: AdoContext): Promise<IterationMetadata[]> {
    const activeContext = await this.resolveContext(context);
    
    // Use the classification nodes endpoint to get the iteration hierarchy
    // This provides all project iterations regardless of team
    const url = `https://dev.azure.com/${activeContext.organization}/${activeContext.project}/_apis/wit/classificationnodes/Iterations?$depth=10&api-version=${API_VERSION}`;

    console.log(`[iterations-adapter] Fetching iterations from classification nodes: ${url}`);

    let response: HttpResponse;
    try {
      const retried = await this.fetchWithRetry(url);
      response = retried.response;
    } catch (error) {
      console.error("[iterations-adapter-error]", error instanceof Error ? error.message : error);
      throw new Error(`ITERATIONS_LIST_FAILED:${toTransportFailureHint(error)}`);
    }

    if (response.status !== 200) {
      console.error("[iterations-adapter-error] Status:", response.status);
      throw new Error(buildHttpFailureCode("ITERATIONS_LIST_FAILED", response));
    }

    console.log("[iterations-adapter-raw-response]", JSON.stringify(response.json, null, 2));
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

  private async fetchWithRetry(url: string): Promise<RetriedResponse> {
    let lastError: Error | unknown;
    let retriedRequests = 0;

    for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        retriedRequests++;
      }

      try {
        const response = await this.httpClient.get(url);
        if (response.status === 200) {
          return { response, retriedRequests };
        }
        if (response.status !== 429 && response.status !== 503) {
          return { response, retriedRequests };
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("ITERATIONS_FETCH_FAILED");
  }
}

function normalizeIterations(raw: unknown): IterationMetadata[] {
  const result = raw as IterationListResult;
  if (!result || !Array.isArray(result.value)) {
    console.log("[normalizeIterations] No value array in response");
    return [];
  }

  console.log("[normalizeIterations] Processing", result.value.length, "iterations from API");

  const normalized = result.value
    .filter((item) => item && typeof item === "object")
    .map((item, idx) => {
      console.log(`[normalizeIterations-item-${idx}] Full object:`, JSON.stringify(item, null, 2));
      
      // Try to get dates from multiple locations
      // API may return startDate/endDate or startDate/finishDate or in attributes
      const rawStart = item.startDate || item.attributes?.startDate;
      const rawEnd = item.endDate || item.finishDate || item.attributes?.endDate || item.attributes?.finishDate;
      
      console.log(`[normalizeIterations-item-${idx}-dates]`, {
        rawStart,
        rawEnd,
        itemStartDate: item.startDate,
        itemEndDate: item.endDate,
        itemFinishDate: item.finishDate,
        attributesStartDate: item.attributes?.startDate,
        attributesEndDate: item.attributes?.endDate,
        attributesFinishDate: item.attributes?.finishDate,
      });
      
      const startDate = extractDateString(rawStart);
      const endDate = extractDateString(rawEnd);
      
      const normalized = {
        id: String(item.id ?? ""),
        name: String(item.name ?? ""),
        path: String(item.path ?? ""),
        startDate,
        endDate
      };
      
      console.log(`[normalizeIterations-item-${idx}-result] "${normalized.path}": start=${startDate} end=${endDate}`);
      
      return normalized;
    });
    
  console.log(`[normalizeIterations-summary] Processed ${normalized.length} iterations, ${normalized.filter(i => i.startDate && i.endDate).length} have dates`);
  console.log("[normalizeIterations-results]", JSON.stringify(normalized, null, 2));
  return normalized;
}

function extractDateString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Continue to return null
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

/**
 * Normalizes classification nodes (Iterations tree) response into flat list of IterationMetadata
 */
function normalizeClassificationIterations(raw: unknown): IterationMetadata[] {
  const result: IterationMetadata[] = [];
  const root = raw as Record<string, unknown>;

  if (!root) {
    console.log("[normalizeClassificationIterations] Empty response");
    return [];
  }

  // Recursively traverse the classification tree
  const traverse = (node: unknown, parentPath: string = "") => {
    if (!node || typeof node !== "object") {
      return;
    }

    const currentNode = node as Record<string, unknown>;
    const name = String(currentNode.name ?? "");
    const attributes = currentNode.attributes as Record<string, unknown> | undefined;

    // Build the full path
    const fullPath = parentPath ? `${parentPath}\\${name}` : name;

    // Extract dates if this node has attributes
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (attributes) {
      const startDateVal = attributes.startDate;
      const finishDateVal = attributes.finishDate;

      if (startDateVal) {
        startDate = extractDateString(startDateVal);
      }
      if (finishDateVal) {
        endDate = extractDateString(finishDateVal);
      }

      console.log(`[normalizeClassificationIterations-node] ${fullPath}:`, {
        startDate,
        endDate,
        rawAttributes: attributes,
      });
    }

    // Add this iteration to results
    result.push({
      id: String(currentNode.identifier ?? fullPath),
      name,
      path: fullPath,
      startDate,
      endDate,
    });

    // Recursively process children
    const children = currentNode.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        traverse(child, fullPath);
      }
    }
  };

  traverse(root);

  console.log("[normalizeClassificationIterations-summary]", {
    total: result.length,
    withDates: result.filter((i) => i.startDate && i.endDate).length,
    paths: result.map((r) => `${r.path} [${r.startDate ? "✓" : "✗"}]`),
  });

  return result;
}
