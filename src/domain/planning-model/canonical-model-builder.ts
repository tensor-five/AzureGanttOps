import type { IngestionSnapshot } from "../../application/dto/ingestion-snapshot.js";
import type { RequiredFieldMappings } from "../mapping/field-mapping.js";
import type { CanonicalDependency } from "./canonical-dependency.js";
import type { CanonicalTask, CanonicalTaskState } from "./canonical-task.js";

export type CanonicalModel = {
  tasks: CanonicalTask[];
  dependencies: CanonicalDependency[];
};

export function buildCanonicalModel(
  snapshot: IngestionSnapshot,
  mappings: RequiredFieldMappings
): CanonicalModel {
  const tasks = buildTasks(snapshot, mappings);
  const dependencies = buildDependencies(snapshot);

  return {
    tasks,
    dependencies
  };
}

function buildTasks(snapshot: IngestionSnapshot, mappings: RequiredFieldMappings): CanonicalTask[] {
  const byId = new Map<number, IngestionSnapshot["workItems"][number]>();

  snapshot.workItems.forEach((item) => {
    byId.set(item.id, item);
  });

  return snapshot.workItemIds
    .map((workItemId) => {
      const item = byId.get(workItemId);
      if (!item) {
        return null;
      }

      const record = item as unknown as Record<string, unknown>;
      const mappedId = readValue(record, mappings.id) ?? String(item.id);
      const title = readValue(record, mappings.title) ?? item.title;

      return {
        workItemId: item.id,
        mappedId,
        title,
        startDate: toIsoDate(readValue(record, mappings.start)),
        endDate: toIsoDate(readValue(record, mappings.endOrTarget)),
        state: toState(record)
      } satisfies CanonicalTask;
    })
    .filter((task): task is CanonicalTask => task !== null);
}

function buildDependencies(snapshot: IngestionSnapshot): CanonicalDependency[] {
  return snapshot.relations
    .filter(
      (relation) =>
        relation.type === "System.LinkTypes.Dependency-Forward" ||
        relation.type === "System.LinkTypes.Dependency-Reverse"
    )
    .map((relation) => {
      const predecessorWorkItemId =
        relation.type === "System.LinkTypes.Dependency-Forward" ? relation.sourceId : relation.targetId;
      const successorWorkItemId =
        relation.type === "System.LinkTypes.Dependency-Forward" ? relation.targetId : relation.sourceId;

      return {
        predecessorWorkItemId,
        successorWorkItemId,
        relationType: relation.type,
        dependencyType: "FS"
      } as const;
    });
}

function readValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function toState(record: Record<string, unknown>): CanonicalTaskState {
  const code = readValue(record, "System.State") ?? "Unknown";

  return {
    code,
    badge: toBadge(code),
    color: stateColor(code)
  };
}

function toBadge(code: string): string {
  const firstLetter = code.trim().charAt(0).toUpperCase();
  return firstLetter.length > 0 ? firstLetter : "?";
}

function stateColor(code: string): string {
  switch (code.toLowerCase()) {
    case "new":
      return "#7c3aed";
    case "active":
      return "#1d4ed8";
    case "resolved":
      return "#15803d";
    case "closed":
      return "#6b7280";
    default:
      return "#334155";
  }
}
