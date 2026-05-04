import type { FieldMappingProfile, RequiredMappingField } from "./field-mapping.js";

export const DEFAULT_FIELD_CANDIDATES: Record<RequiredMappingField, readonly string[]> = {
  id: ["System.Id", "Custom.ExternalId", "Custom.WorkItemId"],
  title: ["System.Title"],
  start: ["Microsoft.VSTS.Scheduling.StartDate", "Custom.StartDate"],
  endOrTarget: [
    "Microsoft.VSTS.Scheduling.TargetDate",
    "Microsoft.VSTS.Scheduling.FinishDate",
    "Custom.TargetDate"
  ]
};

const DEFAULT_PROFILE_NAME = "Auto-applied Azure default";

export type DefaultMappingProposal =
  | {
      status: "valid";
      profile: FieldMappingProfile;
    }
  | {
      status: "invalid";
      missingRequired: RequiredMappingField[];
    };

export function buildAutoAppliedProfileId(queryId: string): string {
  return `auto:${queryId}`;
}

export function proposeDefaultMapping(params: {
  queryId: string;
  availableFieldRefs: readonly string[];
}): DefaultMappingProposal {
  const pool = new Set(params.availableFieldRefs.map((value) => value.trim()).filter(Boolean));

  const id = firstExisting(pool, DEFAULT_FIELD_CANDIDATES.id);
  const title = firstExisting(pool, DEFAULT_FIELD_CANDIDATES.title);
  const start = firstExisting(pool, DEFAULT_FIELD_CANDIDATES.start);
  const endOrTarget = firstExisting(pool, DEFAULT_FIELD_CANDIDATES.endOrTarget);

  const missingRequired: RequiredMappingField[] = [];
  if (!id) missingRequired.push("id");
  if (!title) missingRequired.push("title");
  if (!start) missingRequired.push("start");
  if (!endOrTarget) missingRequired.push("endOrTarget");

  if (missingRequired.length > 0) {
    return { status: "invalid", missingRequired };
  }

  return {
    status: "valid",
    profile: {
      id: buildAutoAppliedProfileId(params.queryId),
      name: DEFAULT_PROFILE_NAME,
      fields: {
        id: id!,
        title: title!,
        start: start!,
        endOrTarget: endOrTarget!
      }
    }
  };
}

function firstExisting(pool: Set<string>, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (pool.has(candidate)) {
      return candidate;
    }
  }

  return null;
}
