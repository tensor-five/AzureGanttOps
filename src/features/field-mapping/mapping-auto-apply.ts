import type { FieldMappingProfile } from "../../domain/mapping/field-mapping.js";

const QUERY_PROFILE_KEY = "azure-ganttops.query-profile-map";
const DEFAULT_PROFILE_NAME = "Auto-applied Azure default";

export type MappingProposal =
  | {
      status: "valid";
      profile: FieldMappingProfile;
    }
  | {
      status: "invalid";
      missingRequired: Array<"id" | "title" | "start" | "endOrTarget">;
      guidance: string;
    };

export function proposeDefaultMappingForQuery(params: {
  queryId: string;
  availableFieldRefs: string[];
}): MappingProposal {
  const normalized = new Set(params.availableFieldRefs.map((value) => value.trim()).filter(Boolean));

  const id = firstExisting(normalized, ["System.Id", "Custom.ExternalId", "Custom.WorkItemId"]);
  const title = firstExisting(normalized, ["System.Title"]);
  const start = firstExisting(normalized, ["Microsoft.VSTS.Scheduling.StartDate", "Custom.StartDate"]);
  const endOrTarget = firstExisting(normalized, [
    "Microsoft.VSTS.Scheduling.TargetDate",
    "Microsoft.VSTS.Scheduling.FinishDate",
    "Custom.TargetDate"
  ]);

  const missingRequired: Array<"id" | "title" | "start" | "endOrTarget"> = [];

  if (!id) {
    missingRequired.push("id");
  }
  if (!title) {
    missingRequired.push("title");
  }
  if (!start) {
    missingRequired.push("start");
  }
  if (!endOrTarget) {
    missingRequired.push("endOrTarget");
  }

  if (missingRequired.length > 0) {
    return {
      status: "invalid",
      missingRequired,
      guidance: `Missing required mapping fields: ${missingRequired.join(", ")}. Open inline fix panel.`
    };
  }

  return {
    status: "valid",
    profile: {
      id: `auto-${params.queryId}`,
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

export function persistQueryMappingSelection(queryId: string, profileId: string): void {
  const map = readMap();
  map[queryId] = profileId;
  writeMap(map);
}

export function readPersistedQueryMappingSelection(queryId: string): string | undefined {
  const map = readMap();
  return map[queryId];
}

function firstExisting(pool: Set<string>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (pool.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readMap(): Record<string, string> {
  if (typeof localStorage === "undefined") {
    return {};
  }

  const raw = localStorage.getItem(QUERY_PROFILE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const result: Record<string, string> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "string") {
        result[key] = value;
      }
    });
    return result;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(QUERY_PROFILE_KEY, JSON.stringify(map));
}
