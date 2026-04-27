import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { SavedQueryPreference } from "../../shared/user-preferences/user-preferences.client.js";
import { toShortQueryName } from "./ui-client-storage.js";

export function findAzureSavedQueryName(response: QueryIntakeResponse | null, queryId: string): string | null {
  if (!response) {
    return null;
  }

  const normalizedQueryId = queryId.trim().toLowerCase();
  const match = response.savedQueries.find((entry) => entry.id.trim().toLowerCase() === normalizedQueryId);
  if (!match) {
    return null;
  }

  const name = match.name.trim();
  return name.length > 0 ? name : null;
}

export function resolveActiveQueryName(
  activeQueryId: string | null,
  response: QueryIntakeResponse | null,
  savedHeaderQueries: SavedQueryPreference[]
): string | null {
  if (!activeQueryId) {
    return null;
  }
  const fromAzure = findAzureSavedQueryName(response, activeQueryId);
  if (fromAzure) {
    return fromAzure;
  }
  const normalizedQueryId = activeQueryId.trim().toLowerCase();
  const headerMatch = savedHeaderQueries.find(
    (entry) => entry.id.trim().toLowerCase() === normalizedQueryId
  );
  const headerName = headerMatch?.name.trim() ?? "";
  if (headerName.length === 0 || headerName === activeQueryId) {
    return null;
  }
  return headerName;
}

export function filterHeaderQueries(queries: SavedQueryPreference[], searchDraft: string): SavedQueryPreference[] {
  const search = searchDraft.trim().toLowerCase();
  if (!search) {
    return queries;
  }

  return queries.filter((entry) => {
    const shortName = toShortQueryName(entry.name, entry.id).toLowerCase();
    return shortName.includes(search);
  });
}

export function resolveDeletedHeaderQueries(params: {
  queries: SavedQueryPreference[];
  selectedHeaderQueryId: string;
  deletedQueryId: string;
}): { queries: SavedQueryPreference[]; selectedHeaderQueryId: string } {
  const nextSavedQueries = params.queries.filter((entry) => entry.id !== params.deletedQueryId);
  const nextSelectedHeaderQueryId =
    params.selectedHeaderQueryId === params.deletedQueryId
      ? (nextSavedQueries[0]?.id ?? "")
      : params.selectedHeaderQueryId;
  return {
    queries: nextSavedQueries,
    selectedHeaderQueryId: nextSelectedHeaderQueryId
  };
}

export function buildSavedHeaderQueryCandidate(params: {
  queryId: string;
  transportQueryInput: string;
  organization: string;
  project: string;
  azureQueryName: string | null;
  fallbackLabel: string;
}): SavedQueryPreference {
  return {
    id: params.queryId,
    name: toShortQueryName(params.azureQueryName ?? params.fallbackLabel, params.queryId),
    queryInput: params.transportQueryInput,
    organization: params.organization.trim() || undefined,
    project: params.project.trim() || undefined
  };
}
