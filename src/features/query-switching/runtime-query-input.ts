import { parseQueryInput } from "../../domain/query-runtime/services/query-input-parser.js";
import { buildAzureQueryUrl } from "../../shared/azure-devops/azure-query-url.js";

export const ORG_KEY = "azure-ganttops.organization";
export const PROJECT_KEY = "azure-ganttops.project";
export const QUERY_INPUT_KEY = "azure-ganttops.query-input";

export type RuntimeQueryInputDefaults = {
  organization: string;
  project: string;
};

export type RuntimeQueryInputResolution = {
  rawInput: string;
  transportQueryInput: string;
  resolvedContext: {
    organization: string;
    project: string;
    queryId: string;
  };
};

export function resolveRuntimeQueryInput(
  input: string,
  defaults?: Partial<RuntimeQueryInputDefaults> | null
): RuntimeQueryInputResolution {
  const rawInput = input.trim();
  const normalizedDefaults = normalizeDefaults(defaults);
  const context = parseQueryInput(rawInput, normalizedDefaults);
  const queryId = context.queryId.value;
  const transportQueryInput = buildAzureQueryUrl(context.organization, context.project, queryId);

  if (!transportQueryInput) {
    throw new Error("Add organization and project in settings.");
  }

  return {
    rawInput,
    transportQueryInput,
    resolvedContext: {
      organization: context.organization,
      project: context.project,
      queryId
    }
  };
}

export function tryResolveRuntimeQueryInput(
  input: string,
  defaults?: Partial<RuntimeQueryInputDefaults> | null
): RuntimeQueryInputResolution | null {
  try {
    return resolveRuntimeQueryInput(input, defaults);
  } catch {
    return null;
  }
}

export function resolveQueryRunInput(queryInput: string, organization: string, project: string): string | null {
  return tryResolveRuntimeQueryInput(queryInput, { organization, project })?.transportQueryInput ?? null;
}

function normalizeDefaults(defaults?: Partial<RuntimeQueryInputDefaults> | null): RuntimeQueryInputDefaults | undefined {
  const organization = defaults?.organization?.trim() ?? "";
  const project = defaults?.project?.trim() ?? "";

  if (!organization && !project) {
    return undefined;
  }

  return {
    organization,
    project
  };
}
