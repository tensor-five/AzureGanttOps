import type {
  IngestionHydrationMetadata,
  IngestionSnapshot,
  IngestionWorkItem
} from "../../../application/dto/ingestion-snapshot.js";
import type { AdoContext } from "../../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";
import { enforceFlatQueryShape } from "../../../domain/query-runtime/services/query-shape-policy.js";
import { filterRuntimeRelations } from "../../../domain/query-runtime/services/relation-filter-policy.js";

const API_VERSION = "7.1";
const MAX_IDS_PER_BATCH = 200;
const HYDRATION_CONCURRENCY = 3;
const MAX_RETRY_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 4000;

export type SavedQuery = {
  id: string;
  name: string;
  path: string;
};

type HttpResponse = {
  status: number;
  json: unknown;
  headers?: Record<string, string | undefined>;
};

export interface HttpClient {
  get(url: string): Promise<HttpResponse>;
}

type RetriedResponse = {
  response: HttpResponse;
  retriedRequests: number;
};

type WiqlExecutionResult = {
  queryType: string;
  workItemIds: number[];
  workItemRelations: unknown[];
};

type HydrationChunkResult = {
  items: IngestionWorkItem[];
  missingIds: number[];
  retriedRequests: number;
};

export class AzureQueryRuntimeAdapter {
  public constructor(
    private readonly httpClient: HttpClient,
    private readonly contextStore: AdoContextStore
  ) {}

  public async listSavedQueries(context?: AdoContext): Promise<SavedQuery[]> {
    const activeContext = await this.resolveContext(context);
    const url = `https://dev.azure.com/${activeContext.organization}/${activeContext.project}/_apis/wit/queries/Shared%20Queries?$depth=2&api-version=${API_VERSION}`;

    const response = await this.httpClient.get(url);

    if (response.status !== 200) {
      throw new Error(buildHttpFailureCode("QUERY_LIST_FAILED", response));
    }

    return normalizeSavedQueries(response.json);
  }

  public async executeByQueryId(queryId: string, context?: AdoContext): Promise<IngestionSnapshot> {
    const activeContext = await this.resolveContext(context);
    const wiqlUrl = `https://dev.azure.com/${activeContext.organization}/${activeContext.project}/_apis/wit/wiql/${queryId}?api-version=${API_VERSION}`;

    const wiqlResponse = await this.requestWithRetry(
      () => this.httpClient.get(wiqlUrl),
      "QUERY_EXECUTION_FAILED"
    );

    if (wiqlResponse.response.status === 404) {
      throw new Error("QUERY_NOT_FOUND");
    }

    if (wiqlResponse.response.status !== 200) {
      throw new Error(buildHttpFailureCode("QUERY_EXECUTION_FAILED", wiqlResponse.response));
    }

    const wiqlResult = normalizeExecutionPayload(wiqlResponse.response.json);

    enforceFlatQueryShape(wiqlResult.queryType);

    const hydration = await this.hydrateWorkItems(wiqlResult.workItemIds, activeContext);
    const relations = filterRuntimeRelations(wiqlResult.workItemRelations);

    return {
      queryType: "flat",
      workItemIds: wiqlResult.workItemIds,
      workItems: hydration.workItems,
      relations,
      hydration: hydration.metadata
    };
  }

  private async hydrateWorkItems(
    workItemIds: number[],
    context: AdoContext
  ): Promise<{ workItems: IngestionWorkItem[]; metadata: IngestionHydrationMetadata }> {
    if (workItemIds.length === 0) {
      return {
        workItems: [],
        metadata: {
          maxIdsPerBatch: MAX_IDS_PER_BATCH,
          requestedIds: 0,
          attemptedBatches: 0,
          succeededBatches: 0,
          retriedRequests: 0,
          missingIds: [],
          partial: false,
          statusCode: "OK"
        }
      };
    }

    const idChunks = chunkIds(workItemIds, MAX_IDS_PER_BATCH);
    const chunkResults: HydrationChunkResult[] = new Array(idChunks.length);

    let cursor = 0;
    const runWorker = async () => {
      while (cursor < idChunks.length) {
        const chunkIndex = cursor;
        cursor += 1;

        const chunk = idChunks[chunkIndex];
        chunkResults[chunkIndex] = await this.hydrateChunk(chunk, context);
      }
    };

    const workers = Array.from({ length: Math.min(HYDRATION_CONCURRENCY, idChunks.length) }, () => runWorker());
    await Promise.all(workers);

    const byId = new Map<number, IngestionWorkItem>();
    const missingIds: number[] = [];
    let retriedRequests = 0;

    for (const chunkResult of chunkResults) {
      retriedRequests += chunkResult.retriedRequests;

      for (const item of chunkResult.items) {
        byId.set(item.id, item);
      }

      missingIds.push(...chunkResult.missingIds);
    }

    const orderedWorkItems = workItemIds
      .map((id) => byId.get(id))
      .filter((item): item is IngestionWorkItem => item !== undefined);

    const partial = missingIds.length > 0;

    return {
      workItems: orderedWorkItems,
      metadata: {
        maxIdsPerBatch: MAX_IDS_PER_BATCH,
        requestedIds: workItemIds.length,
        attemptedBatches: idChunks.length,
        succeededBatches: chunkResults.length,
        retriedRequests,
        missingIds,
        partial,
        statusCode: partial ? "HYDRATION_PARTIAL_FAILURE" : "OK"
      }
    };
  }

  private async hydrateChunk(chunkIdsValue: number[], context: AdoContext): Promise<HydrationChunkResult> {
    const ids = chunkIdsValue.join(",");
    const url = `https://dev.azure.com/${context.organization}/${context.project}/_apis/wit/workitems?ids=${ids}&errorPolicy=Omit&api-version=${API_VERSION}`;

    const { response, retriedRequests } = await this.requestWithRetry(
      () => this.httpClient.get(url),
      "HYDRATION_TRANSIENT_RETRY_EXHAUSTED"
    );

    if (response.status !== 200) {
      throw new Error(buildHttpFailureCode("HYDRATION_REQUEST_FAILED", response));
    }

    const items = normalizeHydratedItems(response.json);
    const returnedIds = new Set(items.map((item) => item.id));
    const missingIds = chunkIdsValue.filter((id) => !returnedIds.has(id));

    return {
      items,
      missingIds,
      retriedRequests
    };
  }

  private async requestWithRetry(
    request: () => Promise<HttpResponse>,
    exhaustedErrorCode: string
  ): Promise<RetriedResponse> {
    let retriedRequests = 0;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await request();

        if (!isTransientStatus(response.status)) {
          return {
            response,
            retriedRequests
          };
        }

        if (attempt >= MAX_RETRY_ATTEMPTS) {
          throw new Error(exhaustedErrorCode);
        }

        retriedRequests += 1;

        const retryAfterMs = parseRetryAfterMilliseconds(response.headers?.["retry-after"]);
        await wait(computeBackoffDelayMs(attempt, retryAfterMs));
      } catch (error) {
        if (!isTransientError(error)) {
          throw error;
        }

        if (attempt >= MAX_RETRY_ATTEMPTS) {
          throw new Error(exhaustedErrorCode);
        }

        retriedRequests += 1;
        await wait(computeBackoffDelayMs(attempt));
      }
    }

    throw new Error(exhaustedErrorCode);
  }

  private async resolveContext(context?: AdoContext): Promise<AdoContext> {
    if (context) {
      return context;
    }

    const stored = await this.contextStore.getActiveContext();

    if (!stored) {
      throw new Error("CONTEXT_REQUIRED");
    }

    return stored;
  }
}

function normalizeSavedQueries(payload: unknown): SavedQuery[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const record = payload as { value?: unknown };
  if (Array.isArray(record.value)) {
    return flattenQueries(record.value);
  }

  return flattenQueries([payload]);
}

function flattenQueries(nodes: unknown[], parentPath = ""): SavedQuery[] {
  const result: SavedQuery[] = [];

  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }

    const record = node as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const name = typeof record.name === "string" ? record.name : "";
    const isFolder = record.isFolder === true;
    const declaredPath = typeof record.path === "string" ? record.path : "";
    const computedPath = declaredPath || [parentPath, name].filter(Boolean).join("/");

    if (!isFolder && id && name && computedPath) {
      result.push({
        id,
        name,
        path: computedPath
      });
    }

    if (Array.isArray(record.children)) {
      result.push(...flattenQueries(record.children, computedPath));
    }
  }

  return result;
}

function normalizeExecutionPayload(payload: unknown): WiqlExecutionResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const queryType = (payload as { queryType?: unknown }).queryType;
  if (typeof queryType !== "string") {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const workItems = (payload as { workItems?: unknown }).workItems;

  if (!Array.isArray(workItems)) {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const workItemIds: number[] = [];
  const seen = new Set<number>();

  for (const item of workItems) {
    if (!item || typeof item !== "object") {
      throw new Error("MALFORMED_PAYLOAD");
    }

    const id = (item as { id?: unknown }).id;

    if (typeof id !== "number") {
      throw new Error("MALFORMED_PAYLOAD");
    }

    if (!seen.has(id)) {
      seen.add(id);
      workItemIds.push(id);
    }
  }

  const workItemRelations = Array.isArray((payload as { workItemRelations?: unknown }).workItemRelations)
    ? ((payload as { workItemRelations: unknown[] }).workItemRelations ?? [])
    : [];

  return {
    queryType,
    workItemIds,
    workItemRelations
  };
}

function normalizeHydratedItems(payload: unknown): IngestionWorkItem[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { value?: unknown }).value)) {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const value = (payload as { value: unknown[] }).value;

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const id = (item as { id?: unknown }).id;
      if (typeof id !== "number") {
        return null;
      }

      const fields = (item as { fields?: unknown }).fields;
      const title =
        fields && typeof fields === "object" && typeof (fields as Record<string, unknown>)["System.Title"] === "string"
          ? ((fields as Record<string, unknown>)["System.Title"] as string)
          : "";

      const flattenedFields: Record<string, string | number | null | undefined> = {};
      if (fields && typeof fields === "object") {
        Object.entries(fields as Record<string, unknown>).forEach(([fieldRef, value]) => {
          if (typeof value === "string" || typeof value === "number") {
            flattenedFields[fieldRef] = value;
            return;
          }

          if (value === null || typeof value === "undefined") {
            flattenedFields[fieldRef] = value;
          }
        });
      }

      return {
        id,
        title,
        ...flattenedFields
      };
    })
    .filter((item): item is IngestionWorkItem => item !== null);
}

function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /(econn|etimedout|network|fetch|timeout|socket)/i.test(error.message);
}

function parseRetryAfterMilliseconds(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number.parseInt(value, 10);

  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  return undefined;
}

function computeBackoffDelayMs(attempt: number, retryAfterMs?: number): number {
  if (typeof retryAfterMs === "number" && retryAfterMs >= 0) {
    return retryAfterMs;
  }

  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
  const deterministicJitter = (attempt * 37) % 100;
  return exponential + deterministicJitter;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildHttpFailureCode(baseCode: string, response: HttpResponse): string {
  const summary = summarizeHttpPayload(response.json);
  const serialized = summary ? `_${summary}` : "";
  return `${baseCode}_HTTP_${response.status}${serialized}`;
}

function summarizeHttpPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const directMessage = firstString([
    record.message,
    record.error,
    record.typeKey,
    record.customMessage,
    record.rawText
  ]);

  if (directMessage) {
    return normalizeErrorFragment(directMessage);
  }

  const inner = record.value;
  if (Array.isArray(inner) && inner.length > 0) {
    const first = inner[0];
    if (first && typeof first === "object") {
      const nested = first as Record<string, unknown>;
      const nestedMessage = firstString([
        nested.message,
        nested.error,
        nested.typeKey,
        nested.customMessage
      ]);
      if (nestedMessage) {
        return normalizeErrorFragment(nestedMessage);
      }
    }
  }

  return "";
}

function firstString(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function normalizeErrorFragment(input: string): string {
  const alnum = input.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return alnum.slice(0, 64);
}
