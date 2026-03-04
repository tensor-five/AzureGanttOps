import type { QueryContext } from "../entities/query-context.js";
import { QueryId } from "../value-objects/query-id.js";

type ContextDefaults = {
  organization: string;
  project: string;
};

const QUERY_GUID_EXTRACT_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function parseQueryInput(input: string, defaults?: ContextDefaults): QueryContext {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    throw new Error("Paste a valid Azure DevOps query URL.");
  }

  if (isQueryIdLike(normalizedInput)) {
    return fromRawQueryId(normalizedInput, defaults);
  }

  return fromAzureQueryUrl(normalizedInput);
}

function fromRawQueryId(value: string, defaults?: ContextDefaults): QueryContext {
  const queryId = QueryId.create(value);

  if (!defaults) {
    throw new Error("Add organization and project in settings.");
  }

  const organization = defaults.organization.trim();
  const project = defaults.project.trim();

  if (!organization || !project) {
    throw new Error("Add organization and project in settings.");
  }

  return {
    organization,
    project,
    queryId
  };
}

function fromAzureQueryUrl(value: string): QueryContext {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Paste a valid Azure DevOps query URL.");
  }

  if (url.hostname.toLowerCase() !== "dev.azure.com") {
    throw new Error("Paste a valid Azure DevOps query URL.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const organization = segments[0] ?? "";
  const project = segments[1] ?? "";

  const queryIdCandidate =
    url.searchParams.get("qid") ?? url.searchParams.get("id") ?? extractGuidFromPath(url.pathname);

  if (!organization || !project || !queryIdCandidate) {
    throw new Error("Paste a valid Azure DevOps query URL.");
  }

  return {
    organization,
    project,
    queryId: QueryId.create(queryIdCandidate)
  };
}

function extractGuidFromPath(pathname: string): string | null {
  const match = pathname.match(QUERY_GUID_EXTRACT_PATTERN);
  return match ? match[0] : null;
}

function isQueryIdLike(value: string): boolean {
  return value.length === 36 && value.includes("-");
}
