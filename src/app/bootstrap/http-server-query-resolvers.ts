import type { AdoContextStore } from "../config/ado-context.store.js";
import type { HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";

type WorkItemStateOption = {
  name: string;
  color: string | null;
};

export async function fetchQueryDetails(input: {
  queryId: string;
  contextStore: AdoContextStore;
  httpClient: HttpClient;
  apiVersion: string;
}): Promise<{ id: string; name: string; path: string }> {
  const context = await input.contextStore.getActiveContext();
  if (!context) {
    throw new Error("CONTEXT_REQUIRED");
  }

  const url =
    `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}` +
    `/_apis/wit/queries/${encodeURIComponent(input.queryId)}?$includeDeleted=true&api-version=${input.apiVersion}`;
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

export async function fetchAllowedStateCodesForWorkItem(input: {
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
