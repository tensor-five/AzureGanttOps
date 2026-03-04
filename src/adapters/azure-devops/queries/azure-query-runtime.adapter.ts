import type { IngestionRelationType } from "../../../application/dto/ingestion-snapshot.js";
import type { AdoContext } from "../../../application/ports/context-settings.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";

const API_VERSION = "7.1";
const DEP_FORWARD = "System.LinkTypes.Dependency-Forward";
const DEP_REVERSE = "System.LinkTypes.Dependency-Reverse";

export type SavedQuery = {
  id: string;
  name: string;
  path: string;
};

export type RuntimeRelation = {
  type: IngestionRelationType;
  sourceId: number;
  targetId: number;
};

export type RuntimeSnapshot = {
  workItemIds: number[];
  relations: RuntimeRelation[];
};

export interface HttpClient {
  get(url: string): Promise<{
    status: number;
    json: unknown;
  }>;
}

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
      throw new Error("QUERY_LIST_FAILED");
    }

    return normalizeSavedQueries(response.json);
  }

  public async executeByQueryId(queryId: string, context?: AdoContext): Promise<RuntimeSnapshot> {
    const activeContext = await this.resolveContext(context);
    const url = `https://dev.azure.com/${activeContext.organization}/${activeContext.project}/_apis/wit/wiql/${queryId}?api-version=${API_VERSION}`;

    const response = await this.httpClient.get(url);

    if (response.status === 404) {
      throw new Error("QUERY_NOT_FOUND");
    }

    if (response.status !== 200) {
      throw new Error("QUERY_EXECUTION_FAILED");
    }

    return normalizeExecutionPayload(response.json);
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
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { value?: unknown }).value)) {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const roots = (payload as { value: unknown[] }).value;

  return flattenQueries(roots);
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

function normalizeExecutionPayload(payload: unknown): RuntimeSnapshot {
  if (!payload || typeof payload !== "object") {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const workItems = (payload as { workItems?: unknown }).workItems;

  if (!Array.isArray(workItems)) {
    throw new Error("MALFORMED_PAYLOAD");
  }

  const workItemIds = workItems.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("MALFORMED_PAYLOAD");
    }

    const id = (item as { id?: unknown }).id;

    if (typeof id !== "number") {
      throw new Error("MALFORMED_PAYLOAD");
    }

    return id;
  });

  const workItemRelations = Array.isArray((payload as { workItemRelations?: unknown }).workItemRelations)
    ? ((payload as { workItemRelations: unknown[] }).workItemRelations ?? [])
    : [];

  const relations: RuntimeRelation[] = [];

  for (const relation of workItemRelations) {
    if (!relation || typeof relation !== "object") {
      continue;
    }

    const record = relation as Record<string, unknown>;
    const type = typeof record.rel === "string" ? record.rel : "";

    if (type !== DEP_FORWARD && type !== DEP_REVERSE) {
      continue;
    }

    const sourceId = extractEndpointId(record.source);
    const targetId = extractEndpointId(record.target);

    if (sourceId === null || targetId === null) {
      continue;
    }

    relations.push({
      type,
      sourceId,
      targetId
    });
  }

  return {
    workItemIds,
    relations
  };
}

function extractEndpointId(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === "number" ? id : null;
}
